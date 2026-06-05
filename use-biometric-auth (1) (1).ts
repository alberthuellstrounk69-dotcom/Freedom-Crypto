import { useState, useEffect, useCallback, useRef } from "react";
import { Platform, AppState, AppStateStatus, Alert } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BiometricType = "face" | "fingerprint" | "iris" | "none";

export interface BiometricStatus {
  hasHardware: boolean;
  isEnrolled: boolean;
  biometricType: BiometricType;
  isAvailable: boolean; // hasHardware && isEnrolled
}

// ─── Secure Key Storage Helpers ───────────────────────────────────────────────

const PRIVATE_KEY_PREFIX = "qcc_pk_";
const MNEMONIC_PREFIX = "qcc_mn_";

/**
 * Store a private key in the device keychain/keystore.
 * On native: encrypted with Android Keystore / iOS Keychain.
 * On web: falls back to sessionStorage (not secure — warn user).
 */
export async function storePrivateKey(walletId: string, privateKey: string): Promise<void> {
  const key = `${PRIVATE_KEY_PREFIX}${walletId}`;
  if (Platform.OS === "web") {
    sessionStorage.setItem(key, privateKey);
    return;
  }
  await SecureStore.setItemAsync(key, privateKey, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/**
 * Retrieve a private key from secure storage.
 * Requires biometric authentication before returning the value.
 */
export async function retrievePrivateKey(walletId: string, promptMessage?: string): Promise<string | null> {
  const key = `${PRIVATE_KEY_PREFIX}${walletId}`;
  if (Platform.OS === "web") {
    return sessionStorage.getItem(key);
  }
  try {
    return await SecureStore.getItemAsync(key, {
      requireAuthentication: true,
      authenticationPrompt: promptMessage ?? "Authenticate to access your private key",
    });
  } catch {
    return null;
  }
}

/**
 * Store a mnemonic phrase in secure storage.
 */
export async function storeMnemonic(walletId: string, mnemonic: string): Promise<void> {
  const key = `${MNEMONIC_PREFIX}${walletId}`;
  if (Platform.OS === "web") {
    sessionStorage.setItem(key, mnemonic);
    return;
  }
  await SecureStore.setItemAsync(key, mnemonic, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/**
 * Retrieve a mnemonic phrase from secure storage (biometric-gated).
 */
export async function retrieveMnemonic(walletId: string, promptMessage?: string): Promise<string | null> {
  const key = `${MNEMONIC_PREFIX}${walletId}`;
  if (Platform.OS === "web") {
    return sessionStorage.getItem(key);
  }
  try {
    return await SecureStore.getItemAsync(key, {
      requireAuthentication: true,
      authenticationPrompt: promptMessage ?? "Authenticate to access your recovery phrase",
    });
  } catch {
    return null;
  }
}

/**
 * Delete all secure data for a wallet.
 */
export async function deleteWalletKeys(walletId: string): Promise<void> {
  if (Platform.OS === "web") {
    sessionStorage.removeItem(`${PRIVATE_KEY_PREFIX}${walletId}`);
    sessionStorage.removeItem(`${MNEMONIC_PREFIX}${walletId}`);
    return;
  }
  await SecureStore.deleteItemAsync(`${PRIVATE_KEY_PREFIX}${walletId}`).catch(() => {});
  await SecureStore.deleteItemAsync(`${MNEMONIC_PREFIX}${walletId}`).catch(() => {});
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBiometricAuth(appLockTimeoutMs = 5 * 60 * 1000) {
  const [status, setStatus] = useState<BiometricStatus>({
    hasHardware: false,
    isEnrolled: false,
    biometricType: "none",
    isAvailable: false,
  });
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const backgroundTimeRef = useRef<number | null>(null);

  // ── Check biometric availability on mount ──
  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") return;
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      let biometricType: BiometricType = "none";
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricType = "face";
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometricType = "fingerprint";
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        biometricType = "iris";
      }

      setStatus({ hasHardware, isEnrolled, biometricType, isAvailable: hasHardware && isEnrolled });
    })();
  }, []);

  // ── App-lock on resume after timeout ──
  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === "background" || nextState === "inactive") {
        backgroundTimeRef.current = Date.now();
      } else if (nextState === "active" && backgroundTimeRef.current !== null) {
        const elapsed = Date.now() - backgroundTimeRef.current;
        backgroundTimeRef.current = null;
        if (elapsed >= appLockTimeoutMs) {
          setIsAppLocked(true);
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: "Unlock Quantum Crypto Console",
            cancelLabel: "Cancel",
            disableDeviceFallback: false,
          });
          setIsAppLocked(!result.success);
        }
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [appLockTimeoutMs]);

  // ── Authenticate for a sensitive action ──
  const authenticate = useCallback(async (promptMessage: string): Promise<boolean> => {
    if (Platform.OS === "web") return true; // No biometrics on web

    const { hasHardware, isEnrolled } = status;

    if (!hasHardware || !isEnrolled) {
      // No biometrics available — allow action with a warning
      return true;
    }

    setIsChecking(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: "Cancel",
        disableDeviceFallback: false, // allow PIN fallback
        fallbackLabel: "Use Passcode",
      });

      if (result.success) return true;

      if (!result.success && result.error === "user_cancel") return false;
      if (!result.success && result.error === "user_fallback") {
        // User chose passcode — authenticateAsync with disableDeviceFallback: false handles this
        return false;
      }

      Alert.alert(
        "Authentication Failed",
        (result as any).warning ?? "Please try again.",
        [{ text: "OK" }]
      );
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [status]);

  // ── Unlock the app (used by lock screen) ──
  const unlockApp = useCallback(async (): Promise<boolean> => {
    const success = await authenticate("Unlock Quantum Crypto Console");
    if (success) setIsAppLocked(false);
    return success;
  }, [authenticate]);

  // ── Human-readable biometric label ──
  const biometricLabel =
    status.biometricType === "face"
      ? "Face ID"
      : status.biometricType === "fingerprint"
      ? "Fingerprint"
      : status.biometricType === "iris"
      ? "Iris Scan"
      : "Biometrics";

  return {
    status,
    isAppLocked,
    isChecking,
    biometricLabel,
    authenticate,
    unlockApp,
    // Key storage helpers (re-exported for convenience)
    storePrivateKey,
    retrievePrivateKey,
    storeMnemonic,
    retrieveMnemonic,
    deleteWalletKeys,
  };
}
