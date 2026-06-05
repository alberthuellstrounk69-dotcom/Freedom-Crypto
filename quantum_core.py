"""
Quantum Core Module - Main interface for quantum computing operations
Supports multiple backends: Qiskit, Cirq, PennyLane
"""

import asyncio
from typing import Optional, Dict, Any, List, Union
from dataclasses import dataclass, field
from enum import Enum
import logging
from abc import ABC, abstractmethod

# Quantum imports
try:
    from qiskit import QuantumCircuit, transpile
    from qiskit_aer import AerSimulator
    from qiskit_ibm_runtime import QiskitRuntimeService, Session, SamplerV2 as Sampler
    from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
    QISKIT_AVAILABLE = True
except ImportError:
    QISKIT_AVAILABLE = False

try:
    import cirq
    CIRQ_AVAILABLE = True
except ImportError:
    CIRQ_AVAILABLE = False

try:
    import pennylane as qml
    PENNYLANE_AVAILABLE = True
except ImportError:
    PENNYLANE_AVAILABLE = False

logger = logging.getLogger(__name__)


class BackendType(Enum):
    """Supported quantum backend types"""
    QISKIT_AER = "qiskit_aer"
    QISKIT_IBM = "qiskit_ibm"
    CIRQ = "cirq"
    PENNYLANE = "pennylane"
    QUANTUM_SIMULATOR = "quantum_simulator"


@dataclass
class QuantumResult:
    """Container for quantum computation results"""
    counts: Dict[str, int] = field(default_factory=dict)
    statevector: Optional[List[complex]] = None
    probabilities: Dict[str, float] = field(default_factory=dict)
    execution_time: float = 0.0
    shots: int = 1024
    backend: str = ""
    success: bool = True
    error_message: str = ""


class QuantumBackend(ABC):
    """Abstract base class for quantum backends"""
    
    @abstractmethod
    async def execute(self, circuit: Any, shots: int = 1024) -> QuantumResult:
        """Execute a quantum circuit"""
        pass
    
    @abstractmethod
    def create_circuit(self, num_qubits: int) -> Any:
        """Create a quantum circuit"""
        pass
    
    @abstractmethod
    def add_gate(self, circuit: Any, gate: str, qubits: List[int], 
                 params: Optional[List[float]] = None) -> None:
        """Add a gate to the circuit"""
        pass


class QiskitAerBackend(QuantumBackend):
    """Qiskit Aer simulator backend"""
    
    def __init__(self, noise_model: Optional[Dict] = None):
        if not QISKIT_AVAILABLE:
            raise ImportError("Qiskit is not installed. Run: pip install qiskit qiskit-aer")
        self.simulator = AerSimulator()
        self.noise_model = noise_model
        
    def create_circuit(self, num_qubits: int) -> 'QuantumCircuit':
        return QuantumCircuit(num_qubits)
    
    def add_gate(self, circuit: 'QuantumCircuit', gate: str, qubits: List[int],
                 params: Optional[List[float]] = None) -> None:
        gate_lower = gate.lower()
        
        if gate_lower == 'h':
            circuit.h(qubits[0])
        elif gate_lower == 'x':
            circuit.x(qubits[0])
        elif gate_lower == 'y':
            circuit.y(qubits[0])
        elif gate_lower == 'z':
            circuit.z(qubits[0])
        elif gate_lower == 'cx' or gate_lower == 'cnot':
            circuit.cx(qubits[0], qubits[1])
        elif gate_lower == 'cz':
            circuit.cz(qubits[0], qubits[1])
        elif gate_lower == 'swap':
            circuit.swap(qubits[0], qubits[1])
        elif gate_lower == 'rx':
            circuit.rx(params[0], qubits[0])
        elif gate_lower == 'ry':
            circuit.ry(params[0], qubits[0])
        elif gate_lower == 'rz':
            circuit.rz(params[0], qubits[0])
        elif gate_lower == 'u1':
            circuit.u1(params[0], qubits[0])
        elif gate_lower == 'u2':
            circuit.u2(params[0], params[1], qubits[0])
        elif gate_lower == 'u3':
            circuit.u3(params[0], params[1], params[2], qubits[0])
        elif gate_lower == 'ccx' or gate_lower == 'toffoli':
            circuit.ccx(qubits[0], qubits[1], qubits[2])
        else:
            raise ValueError(f"Unknown gate: {gate}")
    
    async def execute(self, circuit: 'QuantumCircuit', shots: int = 1024) -> QuantumResult:
        import time
        start_time = time.time()
        
        try:
            # Add measurements if not present
            if not circuit.clbits:
                circuit.measure_all()
            
            # Transpile for the simulator
            transpiled = transpile(circuit, self.simulator)
            
            # Run the simulation
            job = self.simulator.run(transpiled, shots=shots)
            result = job.result()
            counts = result.get_counts()
            
            # Calculate probabilities
            probabilities = {state: count / shots for state, count in counts.items()}
            
            execution_time = time.time() - start_time
            
            return QuantumResult(
                counts=counts,
                probabilities=probabilities,
                execution_time=execution_time,
                shots=shots,
                backend="qiskit_aer",
                success=True
            )
        except Exception as e:
            logger.error(f"Qiskit execution error: {e}")
            return QuantumResult(
                success=False,
                error_message=str(e),
                backend="qiskit_aer"
            )


class QiskitIBMBackend(QuantumBackend):
    """IBM Quantum hardware backend"""
    
    def __init__(self, token: Optional[str] = None, instance: str = "ibm-q/open/main"):
        if not QISKIT_AVAILABLE:
            raise ImportError("Qiskit is not installed")
        
        self.token = token
        self.instance = instance
        self.service: Optional[QiskitRuntimeService] = None
        self._initialized = False
        
    async def _initialize(self):
        if not self._initialized:
            if self.token:
                self.service = QiskitRuntimeService(
                    channel="ibm_quantum",
                    token=self.token,
                    instance=self.instance
                )
            else:
                self.service = QiskitRuntimeService(channel="ibm_quantum")
            self._initialized = True
    
    def create_circuit(self, num_qubits: int) -> 'QuantumCircuit':
        return QuantumCircuit(num_qubits)
    
    def add_gate(self, circuit: 'QuantumCircuit', gate: str, qubits: List[int],
                 params: Optional[List[float]] = None) -> None:
        # Same as Aer backend
        backend = QiskitAerBackend()
        backend.add_gate(circuit, gate, qubits, params)
    
    async def execute(self, circuit: 'QuantumCircuit', shots: int = 1024,
                      backend_name: str = "ibmq_qasm_simulator") -> QuantumResult:
        import time
        start_time = time.time()
        
        try:
            await self._initialize()
            
            backend = self.service.backend(backend_name)
            pm = generate_preset_pass_manager(backend=backend, optimization_level=3)
            transpiled = pm.run(circuit)
            
            with Session(backend=backend) as session:
                sampler = Sampler(session)
                job = sampler.run([transpiled], shots=shots)
                result = job.result()
                
                # Process results
                counts = result[0].data.meas.get_counts()
                probabilities = {state: count / shots for state, count in counts.items()}
                
                execution_time = time.time() - start_time
                
                return QuantumResult(
                    counts=counts,
                    probabilities=probabilities,
                    execution_time=execution_time,
                    shots=shots,
                    backend=f"ibm_{backend_name}",
                    success=True
                )
        except Exception as e:
            logger.error(f"IBM Quantum execution error: {e}")
            return QuantumResult(
                success=False,
                error_message=str(e),
                backend="ibm_quantum"
            )


class CirqBackend(QuantumBackend):
    """Google Cirq backend"""
    
    def __init__(self):
        if not CIRQ_AVAILABLE:
            raise ImportError("Cirq is not installed. Run: pip install cirq")
        self.simulator = cirq.Simulator()
    
    def create_circuit(self, num_qubits: int) -> 'cirq.Circuit':
        qubits = [cirq.LineQubit(i) for i in range(num_qubits)]
        return cirq.Circuit(), qubits
    
    def add_gate(self, circuit_tuple: tuple, gate: str, qubits: List[int],
                 params: Optional[List[float]] = None) -> None:
        circuit, all_qubits = circuit_tuple
        target_qubits = [all_qubits[i] for i in qubits]
        
        gate_lower = gate.lower()
        
        if gate_lower == 'h':
            circuit.append(cirq.H(target_qubits[0]))
        elif gate_lower == 'x':
            circuit.append(cirq.X(target_qubits[0]))
        elif gate_lower == 'y':
            circuit.append(cirq.Y(target_qubits[0]))
        elif gate_lower == 'z':
            circuit.append(cirq.Z(target_qubits[0]))
        elif gate_lower == 'cx' or gate_lower == 'cnot':
            circuit.append(cirq.CNOT(target_qubits[0], target_qubits[1]))
        elif gate_lower == 'rx':
            circuit.append(cirq.Rx(params[0])(target_qubits[0]))
        elif gate_lower == 'ry':
            circuit.append(cirq.Ry(params[0])(target_qubits[0]))
        elif gate_lower == 'rz':
            circuit.append(cirq.Rz(params[0])(target_qubits[0]))
    
    async def execute(self, circuit_tuple: tuple, shots: int = 1024) -> QuantumResult:
        import time
        start_time = time.time()
        
        try:
            circuit, qubits = circuit_tuple
            circuit.append(cirq.measure(*qubits, key='result'))
            
            result = self.simulator.run(circuit, repetitions=shots)
            counts = dict(result.histogram(key='result'))
            
            # Convert to binary strings
            str_counts = {}
            for state, count in counts.items():
                binary = format(state, f'0{len(qubits)}b')
                str_counts[binary] = count
            
            probabilities = {state: count / shots for state, count in str_counts.items()}
            execution_time = time.time() - start_time
            
            return QuantumResult(
                counts=str_counts,
                probabilities=probabilities,
                execution_time=execution_time,
                shots=shots,
                backend="cirq",
                success=True
            )
        except Exception as e:
            logger.error(f"Cirq execution error: {e}")
            return QuantumResult(
                success=False,
                error_message=str(e),
                backend="cirq"
            )


class PennyLaneBackend(QuantumBackend):
    """PennyLane backend for quantum machine learning"""
    
    def __init__(self, device_name: str = "default.qubit"):
        if not PENNYLANE_AVAILABLE:
            raise ImportError("PennyLane is not installed. Run: pip install pennylane")
        self.device_name = device_name
    
    def create_circuit(self, num_qubits: int) -> dict:
        return {"num_qubits": num_qubits, "operations": []}
    
    def add_gate(self, circuit_dict: dict, gate: str, qubits: List[int],
                 params: Optional[List[float]] = None) -> None:
        circuit_dict["operations"].append({
            "gate": gate,
            "qubits": qubits,
            "params": params or []
        })
    
    async def execute(self, circuit_dict: dict, shots: int = 1024) -> QuantumResult:
        import time
        start_time = time.time()
        
        try:
            num_qubits = circuit_dict["num_qubits"]
            dev = qml.device(self.device_name, wires=num_qubits, shots=shots)
            
            @qml.qnode(dev)
            def circuit():
                for op in circuit_dict["operations"]:
                    gate = op["gate"].lower()
                    q = op["qubits"]
                    p = op["params"]
                    
                    if gate == 'h':
                        qml.Hadamard(wires=q[0])
                    elif gate == 'x':
                        qml.PauliX(wires=q[0])
                    elif gate == 'y':
                        qml.PauliY(wires=q[0])
                    elif gate == 'z':
                        qml.PauliZ(wires=q[0])
                    elif gate == 'rx':
                        qml.RX(p[0], wires=q[0])
                    elif gate == 'ry':
                        qml.RY(p[0], wires=q[0])
                    elif gate == 'rz':
                        qml.RZ(p[0], wires=q[0])
                    elif gate == 'cx' or gate == 'cnot':
                        qml.CNOT(wires=[q[0], q[1]])
                
                return qml.sample()
            
            samples = circuit()
            counts = {}
            for sample in samples:
                binary = ''.join(map(str, sample.astype(int)))
                counts[binary] = counts.get(binary, 0) + 1
            
            probabilities = {state: count / shots for state, count in counts.items()}
            execution_time = time.time() - start_time
            
            return QuantumResult(
                counts=counts,
                probabilities=probabilities,
                execution_time=execution_time,
                shots=shots,
                backend="pennylane",
                success=True
            )
        except Exception as e:
            logger.error(f"PennyLane execution error: {e}")
            return QuantumResult(
                success=False,
                error_message=str(e),
                backend="pennylane"
            )


class QuantumCore:
    """
    Main quantum computing interface
    Provides unified access to multiple quantum backends
    """
    
    def __init__(self, backend_type: BackendType = BackendType.QISKIT_AER,
                 config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.backend_type = backend_type
        self._backend: Optional[QuantumBackend] = None
        self._initialize_backend()
    
    def _initialize_backend(self):
        """Initialize the appropriate quantum backend"""
        if self.backend_type == BackendType.QISKIT_AER:
            self._backend = QiskitAerBackend(
                noise_model=self.config.get('noise_model')
            )
        elif self.backend_type == BackendType.QISKIT_IBM:
            self._backend = QiskitIBMBackend(
                token=self.config.get('ibm_token'),
                instance=self.config.get('instance', 'ibm-q/open/main')
            )
        elif self.backend_type == BackendType.CIRQ:
            self._backend = CirqBackend()
        elif self.backend_type == BackendType.PENNYLANE:
            self._backend = PennyLaneBackend(
                device_name=self.config.get('device', 'default.qubit')
            )
        else:
            raise ValueError(f"Unsupported backend type: {self.backend_type}")
    
    @property
    def backend(self) -> QuantumBackend:
        return self._backend
    
    @property
    def available_backends(self) -> List[str]:
        """List available quantum backends"""
        backends = []
        if QISKIT_AVAILABLE:
            backends.extend(["qiskit_aer", "qiskit_ibm"])
        if CIRQ_AVAILABLE:
            backends.append("cirq")
        if PENNYLANE_AVAILABLE:
            backends.append("pennylane")
        return backends
    
    async def execute_circuit(self, circuit: Any, shots: int = 1024) -> QuantumResult:
        """Execute a quantum circuit"""
        return await self._backend.execute(circuit, shots)
    
    def create_circuit(self, num_qubits: int) -> Any:
        """Create a new quantum circuit"""
        return self._backend.create_circuit(num_qubits)
    
    def add_gate(self, circuit: Any, gate: str, qubits: List[int],
                 params: Optional[List[float]] = None) -> None:
        """Add a gate to a circuit"""
        self._backend.add_gate(circuit, gate, qubits, params)
    
    async def run_bell_state(self) -> QuantumResult:
        """Create and measure a Bell state"""
        circuit = self.create_circuit(2)
        self.add_gate(circuit, 'h', [0])
        self.add_gate(circuit, 'cx', [0, 1])
        return await self.execute_circuit(circuit)
    
    async def run_ghz_state(self, num_qubits: int = 3) -> QuantumResult:
        """Create and measure a GHZ state"""
        circuit = self.create_circuit(num_qubits)
        self.add_gate(circuit, 'h', [0])
        for i in range(num_qubits - 1):
            self.add_gate(circuit, 'cx', [i, i + 1])
        return await self.execute_circuit(circuit)
    
    async def run_quantum_fourier_transform(self, num_qubits: int = 3) -> QuantumResult:
        """Run Quantum Fourier Transform"""
        circuit = self.create_circuit(num_qubits)
        
        for i in range(num_qubits):
            self.add_gate(circuit, 'h', [i])
            for j in range(i + 1, num_qubits):
                angle = 3.14159 / (2 ** (j - i))
                # Add controlled rotation
                self.add_gate(circuit, 'rz', [j], [angle])
        
        return await self.execute_circuit(circuit)
    
    def get_backend_info(self) -> Dict[str, Any]:
        """Get information about the current backend"""
        return {
            "backend_type": self.backend_type.value,
            "available_backends": self.available_backends,
            "config": self.config
        }