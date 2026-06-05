import React, { useState } from "react";
import { useRunQuantumRng, useRunQuantumQkd, useRunGroverSearch, useRunQuantumHash } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cpu, Terminal, Loader2, KeyRound, Search, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function QuantumOperations() {
  const [backend, setBackend] = useState<"qiskit" | "cirq" | "pennylane">("qiskit");
  const [output, setOutput] = useState<string>("");
  const { toast } = useToast();

  const rngMutation = useRunQuantumRng();
  const qkdMutation = useRunQuantumQkd();
  const groverMutation = useRunGroverSearch();
  const hashMutation = useRunQuantumHash();

  const handleOutput = (title: string, data: any) => {
    setOutput(`[${new Date().toISOString()}] ${title}\n${JSON.stringify(data, null, 2)}`);
  };

  const handleError = (error: any) => {
    toast({ title: "Operation Failed", description: error.message || "An error occurred", variant: "destructive" });
    setOutput(`[${new Date().toISOString()}] ERROR\n${error.message}`);
  };

  const handleRng = () => {
    setOutput(`[${new Date().toISOString()}] Initializing Quantum RNG on ${backend}...`);
    rngMutation.mutate(
      { data: { backend, bits: 256 } },
      { onSuccess: (res) => handleOutput("Quantum RNG Result", res), onError: handleError }
    );
  };

  const handleQkd = () => {
    setOutput(`[${new Date().toISOString()}] Initializing BB84 QKD Protocol on ${backend}...`);
    qkdMutation.mutate(
      { data: { backend, protocol: "BB84", key_length: 128 } },
      { onSuccess: (res) => handleOutput("QKD Protocol Result", res), onError: handleError }
    );
  };

  const handleGrover = () => {
    setOutput(`[${new Date().toISOString()}] Running Grover's Search Algorithm...`);
    groverMutation.mutate(
      { data: { search_space: 1024 } },
      { onSuccess: (res) => handleOutput("Grover Search Result", res), onError: handleError }
    );
  };

  const handleHash = () => {
    setOutput(`[${new Date().toISOString()}] Executing QHash-256...`);
    hashMutation.mutate(
      { data: { algorithm: "QHash-256", input: "crypto-data-stream" } },
      { onSuccess: (res) => handleOutput("Quantum Hash Result", res), onError: handleError }
    );
  };

  const isPending = rngMutation.isPending || qkdMutation.isPending || groverMutation.isPending || hashMutation.isPending;

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full">
      <div className="p-5 border-b border-white/10 flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Cpu className="w-5 h-5 text-primary" />
          Q-Operations
        </h2>
        <div className="w-32">
          <Select value={backend} onValueChange={(v: any) => setBackend(v)}>
            <SelectTrigger className="h-8 bg-black/40 border-white/10 text-xs font-mono">
              <SelectValue placeholder="Backend" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="qiskit">IBM Qiskit</SelectItem>
              <SelectItem value="cirq">Google Cirq</SelectItem>
              <SelectItem value="pennylane">PennyLane</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-5 grid grid-cols-2 gap-3">
        <Button 
          variant="outline" 
          onClick={handleRng} 
          disabled={isPending}
          className="bg-black/20 border-white/10 hover:border-primary/50 hover:bg-primary/10 flex flex-col h-auto py-3 gap-2"
        >
          {rngMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Terminal className="w-5 h-5" />}
          <span className="font-mono text-xs">Generate RNG</span>
        </Button>
        <Button 
          variant="outline" 
          onClick={handleQkd} 
          disabled={isPending}
          className="bg-black/20 border-white/10 hover:border-primary/50 hover:bg-primary/10 flex flex-col h-auto py-3 gap-2"
        >
          {qkdMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
          <span className="font-mono text-xs">BB84 QKD</span>
        </Button>
        <Button 
          variant="outline" 
          onClick={handleGrover} 
          disabled={isPending}
          className="bg-black/20 border-white/10 hover:border-primary/50 hover:bg-primary/10 flex flex-col h-auto py-3 gap-2"
        >
          {groverMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          <span className="font-mono text-xs">Grover Search</span>
        </Button>
        <Button 
          variant="outline" 
          onClick={handleHash} 
          disabled={isPending}
          className="bg-black/20 border-white/10 hover:border-primary/50 hover:bg-primary/10 flex flex-col h-auto py-3 gap-2"
        >
          {hashMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Hash className="w-5 h-5" />}
          <span className="font-mono text-xs">QHash-256</span>
        </Button>
      </div>

      <div className="px-5 pb-5 mt-auto flex-1 flex flex-col min-h-[150px]">
        <div className="bg-black/60 rounded-lg p-3 font-mono text-xs text-green-400 overflow-y-auto flex-1 border border-white/5 whitespace-pre-wrap">
          {output || "> Ready for quantum execution..."}
        </div>
      </div>
    </div>
  );
}
