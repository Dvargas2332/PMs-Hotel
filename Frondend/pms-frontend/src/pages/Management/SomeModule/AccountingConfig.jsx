import React from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";

export default function AccountingConfig() {
  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-semibold text-lg">Accounting parameters</h3>
      <p className="text-sm text-gray-600">Configure accounts and prefixes for accounting.</p>
      <div className="grid md:grid-cols-2 gap-3">
        <Input placeholder="Cash account" />
        <Input placeholder="Bank account" />
        <Input placeholder="Journal prefix (e.g. ACC-)" />
        <Input placeholder="Default cost center" />
      </div>
      <Button>Save</Button>
    </Card>
  );
}
