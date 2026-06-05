import * as bip39 from 'bip39';
import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';
import { Wallet, HDNodeWallet } from 'ethers';

/**
 * Wallet Engine - Core cryptographic operations for self-custodial wallet management
 * All operations are performed client-side; no keys leave the browser
 */

export interface StoredWallet {
  id: string;
  name: string;
  type: 'mnemonic' | 'privateKey' | 'ledger';
  encryptedData: string;
  publicAddress: string;
  derivationPath?: string;
  createdAt: number;
}

export interface WalletState {
  wallets: StoredWallet[];
  activeWalletId: string | null;
  isLocked: boolean;
  sessionPassword?: string;
}

/**
 * Generate a new BIP-39 mnemonic phrase (12 or 24 words)
 */
export function generateMnemonic(wordCount: 12 | 24 = 12): string {
  const strength = wordCount === 12 ? 128 : 256;
  return bip39.generateMnemonic(strength);
}

/**
 * Validate a BIP-39 mnemonic phrase
 */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

/**
 * Create a wallet from a BIP-39 mnemonic phrase
 */
export function walletFromMnemonic(
  mnemonic: string,
  derivationPath: string = "m/44'/60'/0'/0/0"
): { wallet: HDNodeWallet; address: string } {
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }

  const hdNode = ethers.HDNodeWallet.fromMnemonic(
    ethers.Mnemonic.fromPhrase(mnemonic),
    derivationPath
  );

  return {
    wallet: hdNode,
    address: hdNode.address,
  };
}

/**
 * Create a wallet from a private key (hex string)
 */
export function walletFromPrivateKey(privateKey: string): { wallet: Wallet; address: string } {
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }

  const wallet = new ethers.Wallet(privateKey);

  return {
    wallet,
    address: wallet.address,
  };
}

/**
 * Derive multiple accounts from a mnemonic
 */
export function deriveAccounts(
  mnemonic: string,
  count: number = 5
): Array<{ address: string; path: string; index: number }> {
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }

  const accounts = [];
  for (let i = 0; i < count; i++) {
    const path = `m/44'/60'/0'/0/${i}`;
    const { address } = walletFromMnemonic(mnemonic, path);
    accounts.push({
      address,
      path,
      index: i,
    });
  }

  return accounts;
}

/**
 * Encrypt sensitive data using AES-256
 */
export function encryptData(data: string, password: string): string {
  return CryptoJS.AES.encrypt(data, password).toString();
}

/**
 * Decrypt sensitive data using AES-256
 */
export function decryptData(encryptedData: string, password: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedData, password);
  return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Store a wallet in encrypted local storage
 */
export function storeWallet(
  wallet: StoredWallet,
  password: string
): void {
  const state = getWalletState(password) || {
    wallets: [],
    activeWalletId: null,
    isLocked: false,
  };

  state.wallets.push(wallet);
  if (!state.activeWalletId) {
    state.activeWalletId = wallet.id;
  }

  saveWalletState(state, password);
}

/**
 * Get all stored wallets from encrypted local storage
 */
export function getWalletState(password: string): WalletState | null {
  const encrypted = localStorage.getItem('walletState');
  if (!encrypted) return null;

  try {
    const decrypted = decryptData(encrypted, password);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to decrypt wallet state:', error);
    return null;
  }
}

/**
 * Save wallet state to encrypted local storage
 */
export function saveWalletState(state: WalletState, password: string): void {
  const encrypted = encryptData(JSON.stringify(state), password);
  localStorage.setItem('walletState', encrypted);
}

/**
 * Create a wallet from a mnemonic and store it
 */
export function importMnemonicWallet(
  mnemonic: string,
  name: string,
  password: string,
  derivationPath: string = "m/44'/60'/0'/0/0"
): StoredWallet {
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }

  const { address } = walletFromMnemonic(mnemonic, derivationPath);
  const encryptedMnemonic = encryptData(mnemonic, password);

  const wallet: StoredWallet = {
    id: generateId(),
    name,
    type: 'mnemonic',
    encryptedData: encryptedMnemonic,
    publicAddress: address,
    derivationPath,
    createdAt: Date.now(),
  };

  storeWallet(wallet, password);
  return wallet;
}

/**
 * Create a wallet from a private key and store it
 */
export function importPrivateKeyWallet(
  privateKey: string,
  name: string,
  password: string
): StoredWallet {
  const { address } = walletFromPrivateKey(privateKey);
  const encryptedPrivateKey = encryptData(privateKey, password);

  const wallet: StoredWallet = {
    id: generateId(),
    name,
    type: 'privateKey',
    encryptedData: encryptedPrivateKey,
    publicAddress: address,
    createdAt: Date.now(),
  };

  storeWallet(wallet, password);
  return wallet;
}

/**
 * Import a keystore JSON file (supports both KeyStore and Crowdsale formats)
 */
export async function importKeystoreWallet(
  keystoreJson: string,
  keystorePassword: string,
  walletName: string,
  storagePassword: string
): Promise<StoredWallet> {
  try {
    const keystoreObj = JSON.parse(keystoreJson);
    const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, keystorePassword);

    const encryptedPrivateKey = encryptData(wallet.privateKey, storagePassword);

    const storedWallet: StoredWallet = {
      id: generateId(),
      name: walletName,
      type: 'privateKey',
      encryptedData: encryptedPrivateKey,
      publicAddress: wallet.address,
      createdAt: Date.now(),
    };

    storeWallet(storedWallet, storagePassword);
    return storedWallet;
  } catch (error) {
    throw new Error(`Failed to import keystore: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export a wallet as a keystore JSON file
 */
export async function exportKeystoreWallet(
  wallet: StoredWallet,
  storagePassword: string,
  keystorePassword: string
): Promise<string> {
  try {
    let privateKey: string;

    if (wallet.type === 'mnemonic') {
      const encryptedMnemonic = wallet.encryptedData;
      const mnemonic = decryptData(encryptedMnemonic, storagePassword);
      const { wallet: hdWallet } = walletFromMnemonic(mnemonic, wallet.derivationPath);
      privateKey = hdWallet.privateKey;
    } else {
      privateKey = decryptData(wallet.encryptedData, storagePassword);
    }

    const ethersWallet = new ethers.Wallet(privateKey);
    const keystoreJson = await ethersWallet.encrypt(keystorePassword);

    return keystoreJson;
  } catch (error) {
    throw new Error(`Failed to export keystore: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a wallet instance from stored encrypted data
 */
export function getWalletInstance(
  wallet: StoredWallet,
  password: string
): Wallet | HDNodeWallet {
  try {
    const decrypted = decryptData(wallet.encryptedData, password);

    if (wallet.type === 'mnemonic') {
      const { wallet: hdWallet } = walletFromMnemonic(decrypted, wallet.derivationPath);
      return hdWallet;
    } else {
      const { wallet: ethersWallet } = walletFromPrivateKey(decrypted);
      return ethersWallet;
    }
  } catch (error) {
    throw new Error(`Failed to retrieve wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sign a message with a wallet
 */
export async function signMessage(
  wallet: Wallet | HDNodeWallet,
  message: string
): Promise<string> {
  return wallet.signMessage(message);
}

/**
 * Sign a transaction with a wallet
 */
export async function signTransaction(
  wallet: Wallet | HDNodeWallet,
  transaction: ethers.TransactionRequest
): Promise<string> {
  return wallet.signTransaction(transaction);
}

/**
 * Generate a unique ID for wallets
 */
function generateId(): string {
  return `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Clear clipboard after a delay (security feature)
 */
export function clearClipboardAfterDelay(delayMs: number = 30000): void {
  setTimeout(() => {
    navigator.clipboard.writeText('');
  }, delayMs);
}

/**
 * Copy text to clipboard and auto-clear after delay
 */
export async function copyToClipboardSecure(text: string, delayMs: number = 30000): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    clearClipboardAfterDelay(delayMs);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
  }
}
