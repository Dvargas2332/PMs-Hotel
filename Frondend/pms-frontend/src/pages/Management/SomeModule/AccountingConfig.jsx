import React from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";

export default function AccountingConfig() {
  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-semibold text-lg">Parámetros contables</h3>
      <p className="text-sm text-gray-600">Configura cuentas y prefijos para contabilidad.</p>
      <div className="grid md:grid-cols-2 gap-3">
        <Input placeholder="Cuenta caja" />
        <Input placeholder="Cuenta bancos" />
        <Input placeholder="Prefijo asientos (ej. ACC-)" />
        <Input placeholder="Centro de costo default" />
      </div>
      <Button>Guardar</Button>
    </Card>
  );
}
