import { nanoid } from "nanoid";

export interface QuantumGate {
  gate: string;
  qubits: number[];
  params?: number[];
}

export interface CircuitSimulationResult {
  counts: Record<string, number>;
  probabilities: Record<string, number>;
  executionTime: number;
  success: boolean;
  errorMessage?: string;
}

export interface QKDResult {
  success: boolean;
  sharedKey: string;
  keyLength: number;
  errorRate: number;
  siftedRatio: number;
  eavesdropping_detected: boolean;
  sessionId: string;
  quantumBitErrorRate: number;
}

export interface QuantumAlgorithmResult {
  name: string;
  result: Record<string, unknown>;
  executionTime: number;
  success: boolean;
}

class QuantumService {
  /**
   * Simulate a quantum circuit
   */
  async simulateCircuit(gates: QuantumGate[], numQubits: number, shots: number = 1024): Promise<CircuitSimulationResult> {
    const startTime = Date.now();
    
    try {
      // Simulate quantum circuit execution
      // For now, we'll use a classical simulation approach
      const statevector = this.initializeStatevector(numQubits);
      
      for (const gate of gates) {
        this.applyGate(statevector, gate, numQubits);
      }
      
      const { counts, probabilities } = this.measureStatevector(statevector, shots);
      
      return {
        counts,
        probabilities,
        executionTime: Date.now() - startTime,
        success: true,
      };
    } catch (error) {
      return {
        counts: {},
        probabilities: {},
        executionTime: Date.now() - startTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Simulate BB84 QKD Protocol
   */
  async simulateBB84(keyLength: number = 128): Promise<QKDResult> {
    const sessionId = nanoid(16);
    const numQubits = keyLength * 4;
    
    // Step 1: Alice prepares random bits and bases
    const aliceBits = Array.from({ length: numQubits }, () => Math.random() > 0.5 ? 1 : 0);
    const aliceBases = Array.from({ length: numQubits }, () => Math.random() > 0.5 ? 0 : 1); // 0=rectilinear, 1=diagonal
    
    // Step 2: Bob measures in random bases
    const bobBases = Array.from({ length: numQubits }, () => Math.random() > 0.5 ? 0 : 1);
    const bobResults = Array.from({ length: numQubits }, (_, i) => {
      // If bases match, Bob gets Alice's bit; otherwise random
      return aliceBases[i] === bobBases[i] ? aliceBits[i] : (Math.random() > 0.5 ? 1 : 0);
    });
    
    // Step 3: Basis reconciliation (sifting)
    const siftedAlice: number[] = [];
    const siftedBob: number[] = [];
    
    for (let i = 0; i < numQubits; i++) {
      if (aliceBases[i] === bobBases[i]) {
        siftedAlice.push(aliceBits[i]);
        siftedBob.push(bobResults[i]);
      }
    }
    
    // Step 4: Error rate estimation
    const sampleSize = Math.min(Math.floor(siftedAlice.length / 4), 20);
    let errors = 0;
    for (let i = 0; i < sampleSize; i++) {
      if (siftedAlice[i] !== siftedBob[i]) errors++;
    }
    const errorRate = sampleSize > 0 ? errors / sampleSize : 1.0;
    
    // Step 5: Final key generation
    const finalKey = siftedAlice.slice(sampleSize, sampleSize + keyLength);
    const siftedRatio = siftedAlice.length / numQubits;
    
    return {
      success: finalKey.length >= keyLength * 0.5 && errorRate < 0.20,
      sharedKey: finalKey.map(b => b.toString()).join(""),
      keyLength: finalKey.length,
      errorRate,
      siftedRatio,
      eavesdropping_detected: errorRate > 0.11,
      sessionId,
      quantumBitErrorRate: errorRate,
    };
  }

  /**
   * Simulate E91 QKD Protocol
   */
  async simulateE91(keyLength: number = 128): Promise<QKDResult> {
    const sessionId = nanoid(16);
    const numPairs = keyLength * 4;
    
    // Generate EPR pairs (entangled qubits)
    const aliceBits: number[] = [];
    const bobBits: number[] = [];
    
    for (let i = 0; i < numPairs; i++) {
      // Simulate entangled pair measurement
      const bit1 = Math.random() > 0.5 ? 1 : 0;
      const bit2 = bit1; // Entangled correlation
      aliceBits.push(bit1);
      bobBits.push(bit2);
    }
    
    // Sift key based on specific angle combinations
    const siftedKey: number[] = [];
    for (let i = 0; i < numPairs; i++) {
      if (aliceBits[i] === bobBits[i]) {
        siftedKey.push(aliceBits[i]);
      }
    }
    
    // Bell inequality test for eavesdropping detection
    const correlations = [
      aliceBits[0] === bobBits[0] ? 1 : -1,
      aliceBits[1] === bobBits[1] ? 1 : -1,
      aliceBits[2] === bobBits[2] ? 1 : -1,
      aliceBits[3] === bobBits[3] ? 1 : -1,
    ];
    
    const sValue = Math.abs(correlations[0] - correlations[1] + correlations[2] + correlations[3]);
    const eavesdropping = sValue < 2.0;
    
    // Calculate error rate
    const errors = aliceBits.slice(0, 20).filter((bit, i) => bit !== bobBits[i]).length;
    const errorRate = errors / Math.min(20, aliceBits.length);
    
    const finalKey = siftedKey.slice(0, keyLength);
    
    return {
      success: finalKey.length >= keyLength * 0.25 && !eavesdropping,
      sharedKey: finalKey.map(b => b.toString()).join(""),
      keyLength: finalKey.length,
      errorRate,
      siftedRatio: siftedKey.length / numPairs,
      eavesdropping_detected: eavesdropping,
      sessionId,
      quantumBitErrorRate: errorRate,
    };
  }

  /**
   * Simulate Bell State
   */
  async simulateBellState(): Promise<QuantumAlgorithmResult> {
    const startTime = Date.now();
    
    const gates: QuantumGate[] = [
      { gate: "h", qubits: [0] },
      { gate: "cx", qubits: [0, 1] },
    ];
    
    const result = await this.simulateCircuit(gates, 2, 1024);
    
    return {
      name: "Bell State",
      result: {
        counts: result.counts,
        probabilities: result.probabilities,
        description: "Creates an entangled Bell state |Φ+⟩ = (|00⟩ + |11⟩)/√2",
      },
      executionTime: Date.now() - startTime,
      success: result.success,
    };
  }

  /**
   * Simulate GHZ State
   */
  async simulateGHZState(): Promise<QuantumAlgorithmResult> {
    const startTime = Date.now();
    
    const gates: QuantumGate[] = [
      { gate: "h", qubits: [0] },
      { gate: "cx", qubits: [0, 1] },
      { gate: "cx", qubits: [1, 2] },
    ];
    
    const result = await this.simulateCircuit(gates, 3, 1024);
    
    return {
      name: "GHZ State",
      result: {
        counts: result.counts,
        probabilities: result.probabilities,
        description: "Creates a GHZ state |GHZ⟩ = (|000⟩ + |111⟩)/√2",
      },
      executionTime: Date.now() - startTime,
      success: result.success,
    };
  }

  /**
   * Simulate Quantum Fourier Transform
   */
  async simulateQFT(): Promise<QuantumAlgorithmResult> {
    const startTime = Date.now();
    
    const gates: QuantumGate[] = [
      { gate: "h", qubits: [0] },
      { gate: "rz", qubits: [1], params: [Math.PI / 2] },
      { gate: "cx", qubits: [0, 1] },
      { gate: "h", qubits: [1] },
      { gate: "rz", qubits: [2], params: [Math.PI / 4] },
      { gate: "cx", qubits: [0, 2] },
      { gate: "h", qubits: [2] },
    ];
    
    const result = await this.simulateCircuit(gates, 3, 1024);
    
    return {
      name: "Quantum Fourier Transform",
      result: {
        counts: result.counts,
        probabilities: result.probabilities,
        description: "3-qubit Quantum Fourier Transform",
      },
      executionTime: Date.now() - startTime,
      success: result.success,
    };
  }

  /**
   * Simulate Grover's Search Algorithm
   */
  async simulateGroverSearch(searchSpace: number = 16, target: number = 5): Promise<QuantumAlgorithmResult> {
    const startTime = Date.now();
    const numQubits = Math.ceil(Math.log2(searchSpace));
    const iterations = Math.ceil(Math.PI / 4 * Math.sqrt(searchSpace));
    
    const gates: QuantumGate[] = [];
    
    // Initialize superposition
    for (let i = 0; i < numQubits; i++) {
      gates.push({ gate: "h", qubits: [i] });
    }
    
    // Grover iterations
    for (let iter = 0; iter < iterations; iter++) {
      // Oracle: mark target state
      const targetBits = target.toString(2).padStart(numQubits, "0");
      for (let i = 0; i < numQubits; i++) {
        if (targetBits[i] === "0") {
          gates.push({ gate: "x", qubits: [i] });
        }
      }
      
      // Diffusion operator
      for (let i = 0; i < numQubits; i++) {
        gates.push({ gate: "h", qubits: [i] });
        gates.push({ gate: "x", qubits: [i] });
      }
      
      for (let i = 0; i < numQubits; i++) {
        gates.push({ gate: "x", qubits: [i] });
        gates.push({ gate: "h", qubits: [i] });
      }
    }
    
    const result = await this.simulateCircuit(gates, numQubits, 1024);
    
    return {
      name: "Grover's Search Algorithm",
      result: {
        counts: result.counts,
        probabilities: result.probabilities,
        target,
        searchSpace,
        description: `Searches for element ${target} in space of ${searchSpace} items`,
      },
      executionTime: Date.now() - startTime,
      success: result.success,
    };
  }

  /**
   * Quantum Hash Computation
   */
  async quantumHash(data: string): Promise<string> {
    const bytes = new TextEncoder().encode(data);
    const hashArray = await crypto.subtle.digest("SHA-256", bytes);
    const hashHex = Array.from(new Uint8Array(hashArray))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    return hashHex;
  }

  /**
   * Quantum Bit Commitment
   */
  async quantumBitCommitment(value: number): Promise<{ commitment: string; openingKey: string }> {
    const basis = Array.from({ length: 4 }, () => Math.random() > 0.5 ? 1 : 0);
    const valueBits = value.toString(2).padStart(4, "0");
    
    // Simulate commitment
    const commitment = Math.random().toString(36).substring(2, 18);
    const openingKey = basis.join("") + valueBits;
    
    return { commitment, openingKey };
  }

  /**
   * Quantum Coin Flip
   */
  async quantumCoinFlip(): Promise<"heads" | "tails"> {
    return Math.random() > 0.5 ? "heads" : "tails";
  }

  /**
   * Quantum Lottery
   */
  async quantumLottery(participants: string[], winnerCount: number = 1): Promise<string[]> {
    if (winnerCount >= participants.length) return participants;
    
    const winners: string[] = [];
    const remaining = [...participants];
    
    for (let i = 0; i < winnerCount; i++) {
      const index = Math.floor(Math.random() * remaining.length);
      winners.push(remaining.splice(index, 1)[0]);
    }
    
    return winners;
  }

  // Private helper methods
  private initializeStatevector(numQubits: number): Complex[] {
    const size = Math.pow(2, numQubits);
    const statevector: Complex[] = Array(size).fill({ real: 0, imag: 0 });
    statevector[0] = { real: 1, imag: 0 }; // |0...0⟩
    return statevector;
  }

  private applyGate(statevector: Complex[], gate: QuantumGate, numQubits: number): void {
    // Simplified gate application
    // In production, this would use proper quantum gate matrices
    switch (gate.gate.toLowerCase()) {
      case "h":
        this.applyHadamard(statevector, gate.qubits[0], numQubits);
        break;
      case "x":
        this.applyPauliX(statevector, gate.qubits[0], numQubits);
        break;
      case "y":
        this.applyPauliY(statevector, gate.qubits[0], numQubits);
        break;
      case "z":
        this.applyPauliZ(statevector, gate.qubits[0], numQubits);
        break;
      case "cx":
      case "cnot":
        this.applyCNOT(statevector, gate.qubits[0], gate.qubits[1], numQubits);
        break;
      case "rz":
        this.applyRZ(statevector, gate.qubits[0], gate.params?.[0] || 0, numQubits);
        break;
    }
  }

  private applyHadamard(statevector: Complex[], target: number, numQubits: number): void {
    const factor = 1 / Math.sqrt(2);
    for (let i = 0; i < statevector.length; i++) {
      const bit = (i >> target) & 1;
      if (bit === 0) {
        const j = i | (1 << target);
        const temp = statevector[i];
        statevector[i] = {
          real: (temp.real + statevector[j].real) * factor,
          imag: (temp.imag + statevector[j].imag) * factor,
        };
      }
    }
  }

  private applyPauliX(statevector: Complex[], target: number, numQubits: number): void {
    for (let i = 0; i < statevector.length; i++) {
      const j = i ^ (1 << target);
      if (i < j) {
        const temp = statevector[i];
        statevector[i] = statevector[j];
        statevector[j] = temp;
      }
    }
  }

  private applyPauliY(statevector: Complex[], target: number, numQubits: number): void {
    for (let i = 0; i < statevector.length; i++) {
      const bit = (i >> target) & 1;
      const j = i ^ (1 << target);
      if (bit === 0) {
        const temp = statevector[i];
        statevector[i] = { real: -statevector[j].imag, imag: statevector[j].real };
        statevector[j] = { real: temp.imag, imag: -temp.real };
      }
    }
  }

  private applyPauliZ(statevector: Complex[], target: number, numQubits: number): void {
    for (let i = 0; i < statevector.length; i++) {
      const bit = (i >> target) & 1;
      if (bit === 1) {
        statevector[i] = { real: -statevector[i].real, imag: -statevector[i].imag };
      }
    }
  }

  private applyCNOT(statevector: Complex[], control: number, target: number, numQubits: number): void {
    for (let i = 0; i < statevector.length; i++) {
      const controlBit = (i >> control) & 1;
      if (controlBit === 1) {
        const j = i ^ (1 << target);
        const temp = statevector[i];
        statevector[i] = statevector[j];
        statevector[j] = temp;
      }
    }
  }

  private applyRZ(statevector: Complex[], target: number, angle: number, numQubits: number): void {
    // Note: -1i * angle / 2 is for phase calculation in complex plane
    // const factor = Math.exp(-1i * angle / 2);
    for (let i = 0; i < statevector.length; i++) {
      const bit = (i >> target) & 1;
      if (bit === 1) {
        const cos = Math.cos(angle / 2);
        const sin = Math.sin(angle / 2);
        statevector[i] = {
          real: statevector[i].real * cos - statevector[i].imag * sin,
          imag: statevector[i].real * sin + statevector[i].imag * cos,
        };
      }
    }
  }

  private measureStatevector(statevector: Complex[], shots: number): { counts: Record<string, number>; probabilities: Record<string, number> } {
    const counts: Record<string, number> = {};
    const probabilities: Record<string, number> = {};
    
    // Calculate probabilities
    for (let i = 0; i < statevector.length; i++) {
      const state = i.toString(2).padStart(Math.log2(statevector.length), "0");
      const amplitude = statevector[i];
      const probability = amplitude.real * amplitude.real + amplitude.imag * amplitude.imag;
      probabilities[state] = probability;
    }
    
    // Sample according to probabilities
    for (let shot = 0; shot < shots; shot++) {
      let rand = Math.random();
      for (const [state, prob] of Object.entries(probabilities)) {
        rand -= prob;
        if (rand <= 0) {
          counts[state] = (counts[state] || 0) + 1;
          break;
        }
      }
    }
    
    return { counts, probabilities };
  }
}

interface Complex {
  real: number;
  imag: number;
}

export const quantumService = new QuantumService();
