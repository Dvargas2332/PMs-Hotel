import React from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";

export default function ChannelManager() {
  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-semibold text-lg">Channel Manager / OTAs</h3>
      <p className="text-sm text-gray-600">Configura credenciales para sincronizar tarifas y disponibilidad.</p>
      <div className="grid md:grid-cols-2 gap-3">
        <Input placeholder="Proveedor (ej. Cloudbeds, SiteMinder)" />
        <Input placeholder="API Key" />
        <Input placeholder="API Secret" />
        <Input placeholder="Hotel ID / Property Code" />
      </div>
      <Button>Save</Button>
    </Card>
  );
}
