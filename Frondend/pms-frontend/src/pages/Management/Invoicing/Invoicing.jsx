//src/pages/Management/Invoicing/Invoicing.jsx

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";

export default function Invoicing() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/e-invoicing");
  }, [navigate]);
  return (
    <Card className="space-y-3 p-5">
      <h3 className="font-medium">Electronic invoicing</h3>
      <div className="text-sm text-gray-600">
        This section moved to the Electronic Invoicing module.
      </div>
      <div className="flex justify-end">
        <Button onClick={() => navigate("/e-invoicing")}>Open module</Button>
      </div>
    </Card>
  );
}
