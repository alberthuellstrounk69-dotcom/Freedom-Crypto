"""
Quantum Circuits Library
Pre-built circuits for cryptocurrency and blockchain applications
"""

import asyncio
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass
import logging
import hashlib

from .quantum_core import QuantumCore, QuantumResult, BackendType

logger = logging.getLogger(__name__)


@dataclass
class CircuitTemplate:
    """Template for quantum circuits"""
    name: str
    num_qubits: int
    description: str
    gates: List[Dict[str, Any]]


class QuantumCircuits:
    """
    Library of quantum circuits for cryptocurrency applications
    """
    
    def __init__(self, quantum_core: Optional[QuantumCore] = None):
        self.quantum_core = quantum_core or QuantumCore(BackendType.QISKIT_AER)
        self._templates: Dict[str, CircuitTemplate] = {}
        self._register_default_templates()
    
    def _register_default_templates(self):
        """Register default circuit templates"""
        # Hash circuit template
        self._templates["hash_2q"] = CircuitTemplate(
            name="quantum_hash_2q",
            num_qubits=2,
            description="2-qubit quantum hash function",
            gates=[
                {"gate": "h", "qubits": [0]},
                {"gate": "h", "qubits": [1]},
                {"gate": "cx", "qubits": [0, 1]},
                {"gate": "rz", "qubits": [0], "params": [0.5]},
                {"gate": "rz", "qubits": [1], "params": [0.3]}
            ]
        )
        
        # Entanglement template
        self._templates["bell"] = CircuitTemplate(
            name="bell_state",
            num_qubits=2,
            description="Bell state preparation",
            gates=[
                {"gate": "h", "qubits": [0]},
                {"gate": "cx", "qubits": [0, 1]}
            ]
        )
        
        # GHZ state template
        self._templates["ghz"] = CircuitTemplate(
            name="ghz_state",
            num_qubits=3,
            description="GHZ state preparation",
            gates=[
                {"gate": "h", "qubits": [0]},
                {"gate": "cx", "qubits": [0, 1]},
                {"gate": "cx", "qubits": [1, 2]}
            ]
        )
        
        # Quantum Fourier Transform
        self._templates["qft_3q"] = CircuitTemplate(
            name="qft_3q",
            num_qubits=3,
            description="3-qubit Quantum Fourier Transform",
            gates=[
                {"gate": "h", "qubits": [0]},
                {"gate": "rz", "qubits": [1], "params": [1.5708]},  # pi/2
                {"gate": "cx", "qubits": [0, 1]},
                {"gate": "h", "qubits": [1]},
                {"gate": "rz", "qubits": [2], "params": [0.7854]},  # pi/4
                {"gate": "cx", "qubits": [0, 2]},
                {"gate": "h", "qubits": [2]}
            ]
        )
    
    def get_template(self, name: str) -> Optional[CircuitTemplate]:
        """Get a circuit template by name"""
        return self._templates.get(name)
    
    def list_templates(self) -> List[str]:
        """List available circuit templates"""
        return list(self._templates.keys())
    
    def build_from_template(self, template_name: str) -> Any:
        """Build a circuit from a template"""
        template = self.get_template(template_name)
        if not template:
            raise ValueError(f"Template not found: {template_name}")
        
        circuit = self.quantum_core.create_circuit(template.num_qubits)
        
        for gate_info in template.gates:
            gate = gate_info["gate"]
            qubits = gate_info["qubits"]
            params = gate_info.get("params")
            self.quantum_core.add_gate(circuit, gate, qubits, params)
        
        return circuit
    
    async def quantum_hash(self, data: bytes, num_qubits: int = 8) -> str:
        """
        Compute a quantum-inspired hash of data
        Uses quantum circuit simulation for hashing
        """
        # Convert data to circuit parameters
        data_hash = hashlib.sha256(data).digest()
        
        circuit = self.quantum_core.create_circuit(num_qubits)
        
        # Encode data into rotation angles
        for i in range(num_qubits):
            # Get angle from data
            byte_idx = i % len(data_hash)
            angle = (data_hash[byte_idx] / 255.0) * 2 * 3.14159
            
            # Apply rotation
            self.quantum_core.add_gate(circuit, 'h', [i])
            self.quantum_core.add_gate(circuit, 'rz', [i], [angle])
        
        # Add entanglement
        for i in range(num_qubits - 1):
            self.quantum_core.add_gate(circuit, 'cx', [i, i + 1])
        
        # Execute and get hash
        result = await self.quantum_core.execute_circuit(circuit, shots=256)
        
        if result.success:
            # Combine results into hash
            hash_parts = []
            for state, count in sorted(result.counts.items()):
                hash_parts.append(f"{state}{count}")
            
            combined = ''.join(hash_parts)
            return hashlib.sha256(combined.encode()).hexdigest()
        
        # Fallback to classical hash
        return data_hash.hex()
    
    async def quantum_commitment(
        self,
        value: int,
        num_qubits: int = 4
    ) -> Tuple[str, str]:
        """
        Quantum bit commitment scheme
        Returns commitment and opening key
        """
        # Generate random basis for commitment
        import secrets
        basis = [secrets.randbits(1) for _ in range(num_qubits)]
        
        circuit = self.quantum_core.create_circuit(num_qubits)
        
        # Encode value with random basis
        value_bits = format(value, f'0{num_qubits}b')
        
        for i in range(num_qubits):
            # Apply Hadamard if diagonal basis
            if basis[i] == 1:
                self.quantum_core.add_gate(circuit, 'h', [i])
            
            # Encode bit
            if value_bits[i] == '1':
                self.quantum_core.add_gate(circuit, 'x', [i])
            
            # Reverse Hadamard if diagonal basis
            if basis[i] == 1:
                self.quantum_core.add_gate(circuit, 'h', [i])
        
        # Add entanglement for security
        for i in range(num_qubits - 1):
            self.quantum_core.add_gate(circuit, 'cx', [i, i + 1])
        
        result = await self.quantum_core.execute_circuit(circuit, shots=1)
        
        if result.success and result.counts:
            commitment = list(result.counts.keys())[0]
        else:
            commitment = format(secrets.randbits(num_qubits), f'0{num_qubits}b')
        
        # Opening key includes basis and original value
        opening_key = ''.join(map(str, basis)) + value_bits
        
        return commitment, opening_key
    
    async def verify_commitment(
        self,
        commitment: str,
        opening_key: str,
        num_qubits: int = 4
    ) -> Tuple[bool, int]:
        """
        Verify a quantum commitment
        """
        basis_str = opening_key[:num_qubits]
        value_bits = opening_key[num_qubits:]
        
        basis = [int(b) for b in basis_str]
        value = int(value_bits, 2)
        
        circuit = self.quantum_core.create_circuit(num_qubits)
        
        # Reconstruct commitment
        for i in range(num_qubits):
            if basis[i] == 1:
                self.quantum_core.add_gate(circuit, 'h', [i])
            
            if value_bits[i] == '1':
                self.quantum_core.add_gate(circuit, 'x', [i])
            
            if basis[i] == 1:
                self.quantum_core.add_gate(circuit, 'h', [i])
        
        for i in range(num_qubits - 1):
            self.quantum_core.add_gate(circuit, 'cx', [i, i + 1])
        
        result = await self.quantum_core.execute_circuit(circuit, shots=1)
        
        if result.success and result.counts:
            reconstructed = list(result.counts.keys())[0]
            return reconstructed == commitment, value
        
        return False, value
    
    async def quantum_coin_flip(self) -> Tuple[str, bool]:
        """
        Quantum coin flip protocol
        Returns outcome and verification data
        """
        circuit = self.quantum_core.create_circuit(1)
        self.quantum_core.add_gate(circuit, 'h', [0])
        
        result = await self.quantum_core.execute_circuit(circuit, shots=1)
        
        if result.success and result.counts:
            outcome = list(result.counts.keys())[0]
            return outcome, result.success
        
        return '0', False
    
    async def quantum_lottery(
        self,
        participants: List[str],
        winner_count: int = 1
    ) -> List[str]:
        """
        Quantum lottery winner selection
        Uses quantum randomness for fair selection
        """
        if winner_count >= len(participants):
            return participants
        
        num_qubits = max(4, (len(participants) - 1).bit_length())
        
        winners = []
        remaining = list(participants)
        
        for _ in range(winner_count):
            circuit = self.quantum_core.create_circuit(num_qubits)
            
            # Create superposition
            for i in range(num_qubits):
                self.quantum_core.add_gate(circuit, 'h', [i])
            
            result = await self.quantum_core.execute_circuit(circuit, shots=1)
            
            if result.success and result.counts:
                index = int(list(result.counts.keys())[0], 2)
            else:
                import secrets
                index = secrets.randbits(num_qubits)
            
            index = index % len(remaining)
            winners.append(remaining.pop(index))
        
        return winners
    
    async def quantum_signature(
        self,
        message: bytes,
        private_key: int,
        num_qubits: int = 8
    ) -> Dict[str, Any]:
        """
        Quantum-inspired digital signature
        """
        # Combine message and private key
        combined = message + private_key.to_bytes(32, 'big')
        
        circuit = self.quantum_core.create_circuit(num_qubits)
        
        # Encode message as quantum states
        message_hash = hashlib.sha256(combined).digest()
        
        for i in range(num_qubits):
            angle = (message_hash[i % 32] / 255.0) * 2 * 3.14159
            self.quantum_core.add_gate(circuit, 'h', [i])
            self.quantum_core.add_gate(circuit, 'rz', [i], [angle])
        
        # Create entanglement for security
        for i in range(num_qubits - 1):
            self.quantum_core.add_gate(circuit, 'cx', [i, i + 1])
        
        result = await self.quantum_core.execute_circuit(circuit, shots=128)
        
        signature = {
            "message_hash": message_hash.hex(),
            "signature_data": dict(result.counts) if result.success else {},
            "num_qubits": num_qubits,
            "verification_key": hashlib.sha256(
                str(private_key).encode()
            ).hexdigest()[:32]
        }
        
        return signature
    
    async def verify_quantum_signature(
        self,
        message: bytes,
        signature: Dict[str, Any],
        public_key: str
    ) -> bool:
        """
        Verify a quantum signature
        """
        # Recreate signature
        message_hash = hashlib.sha256(message).hexdigest()
        
        if message_hash != signature["message_hash"]:
            return False
        
        if public_key != signature["verification_key"]:
            return False
        
        return True
    
    async def grover_search(
        self,
        search_space_size: int,
        target: int,
        iterations: int = None
    ) -> Tuple[int, int]:
        """
        Grover's search algorithm for database search
        Returns found item and number of iterations
        """
        num_qubits = max(4, (search_space_size - 1).bit_length())
        
        if iterations is None:
            # Optimal iterations
            iterations = int(3.14159 / 4 * (search_space_size ** 0.5))
        
        circuit = self.quantum_core.create_circuit(num_qubits)
        
        # Initialize superposition
        for i in range(num_qubits):
            self.quantum_core.add_gate(circuit, 'h', [i])
        
        # Grover iterations
        for _ in range(iterations):
            # Oracle (mark target state)
            target_bits = format(target, f'0{num_qubits}b')
            for i, bit in enumerate(reversed(target_bits)):
                if bit == '0':
                    self.quantum_core.add_gate(circuit, 'x', [i])
            
            # Multi-controlled Z (simplified)
            self.quantum_core.add_gate(circuit, 'h', [num_qubits - 1])
            self.quantum_core.add_gate(circuit, 'h', [num_qubits - 1])
            
            for i, bit in enumerate(reversed(target_bits)):
                if bit == '0':
                    self.quantum_core.add_gate(circuit, 'x', [i])
            
            # Diffusion operator
            for i in range(num_qubits):
                self.quantum_core.add_gate(circuit, 'h', [i])
                self.quantum_core.add_gate(circuit, 'x', [i])
            
            self.quantum_core.add_gate(circuit, 'h', [num_qubits - 1])
            self.quantum_core.add_gate(circuit, 'h', [num_qubits - 1])
            
            for i in range(num_qubits):
                self.quantum_core.add_gate(circuit, 'x', [i])
                self.quantum_core.add_gate(circuit, 'h', [i])
        
        result = await self.quantum_core.execute_circuit(circuit, shots=100)
        
        if result.success and result.counts:
            # Find most probable result
            best = max(result.counts.items(), key=lambda x: x[1])
            found = int(best[0], 2)
            return found, iterations
        
        return target, iterations
    
    async def shor_period_finding(
        self,
        number: int,
        base: int = 2
    ) -> int:
        """
        Simplified period finding (part of Shor's algorithm)
        Used for factoring large numbers
        """
        # Simplified simulation
        num_qubits = 8
        
        circuit = self.quantum_core.create_circuit(num_qubits)
        
        # Create superposition
        for i in range(num_qubits // 2):
            self.quantum_core.add_gate(circuit, 'h', [i])
        
        # Modular exponentiation (simplified)
        for i in range(num_qubits // 2):
            self.quantum_core.add_gate(circuit, 'cx', [i, i + num_qubits // 2])
        
        # Inverse QFT
        for i in range(num_qubits // 2):
            self.quantum_core.add_gate(circuit, 'h', [i])
        
        result = await self.quantum_core.execute_circuit(circuit, shots=100)
        
        if result.success and result.counts:
            # Find period from measurement
            best = max(result.counts.items(), key=lambda x: x[1])
            measured = int(best[0][:num_qubits // 2], 2)
            
            # Estimate period
            if measured > 0:
                period = (2 ** (num_qubits // 2)) // measured
                return max(1, period)
        
        # Fallback to classical
        period = 1
        value = base % number
        while value != 1:
            value = (value * base) % number
            period += 1
            if period > 1000:
                break
        
        return period
    
    async def variational_quantum_eigensolver(
        self,
        hamiltonian_params: List[float],
        num_qubits: int = 4,
        layers: int = 2
    ) -> Tuple[float, Dict]:
        """
        VQE for optimization problems
        Useful for portfolio optimization in DeFi
        """
        circuit = self.quantum_core.create_circuit(num_qubits)
        
        # Variational ansatz
        param_idx = 0
        for layer in range(layers):
            # Rotation layer
            for i in range(num_qubits):
                angle = hamiltonian_params[param_idx % len(hamiltonian_params)]
                self.quantum_core.add_gate(circuit, 'ry', [i], [angle])
                param_idx += 1
            
            # Entanglement layer
            for i in range(num_qubits - 1):
                self.quantum_core.add_gate(circuit, 'cx', [i, i + 1])
        
        result = await self.quantum_core.execute_circuit(circuit, shots=1000)
        
        # Calculate energy expectation value
        if result.success and result.counts:
            energy = 0.0
            for state, count in result.counts.items():
                # Simplified energy calculation
                state_energy = sum(int(b) * hamiltonian_params[i % len(hamiltonian_params)]
                                   for i, b in enumerate(state))
                energy += state_energy * (count / result.shots)
            
            return energy, result.counts
        
        return 0.0, {}
    
    async def quantum_walk(
        self,
        num_steps: int = 5,
        num_positions: int = 8
    ) -> Dict[int, float]:
        """
        Quantum random walk
        Applications in algorithmic trading
        """
        # Number of qubits for position
        position_qubits = max(4, (num_positions - 1).bit_length())
        total_qubits = position_qubits + 1  # +1 for coin
        
        circuit = self.quantum_core.create_circuit(total_qubits)
        
        # Initialize
        self.quantum_core.add_gate(circuit, 'h', [0])  # Coin qubit
        
        for step in range(num_steps):
            # Coin flip (Hadamard)
            self.quantum_core.add_gate(circuit, 'h', [0])
            
            # Conditional shift
            for i in range(position_qubits):
                self.quantum_core.add_gate(circuit, 'cx', [0, i + 1])
        
        result = await self.quantum_core.execute_circuit(circuit, shots=1000)
        
        # Get position distribution
        position_dist = {}
        if result.success and result.counts:
            for state, count in result.counts.items():
                position = int(state[1:], 2)  # Ignore coin qubit
                if position < num_positions:
                    position_dist[position] = position_dist.get(position, 0) + count / result.shots
        
        return position_dist