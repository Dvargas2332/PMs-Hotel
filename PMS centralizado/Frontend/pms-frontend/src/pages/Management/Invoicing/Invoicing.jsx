//src/pages/Management/Invoicing/Invoicing.jsx

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { useLanguage } from "../../../context/LanguageContext";

export default function Invoicing() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/e-invoicing");
  }, [navigate]);
  return (
    <Card className="space-y-3 p-5">
      <h3 className="font-medium">{t("mgmt.invoicing.title")}</h3>
      <div className="text-sm text-slate-400">
        {t("mgmt.invoicing.moved")}
      </div>
      <div className="flex justify-end">
        <Button onClick={() => navigate("/e-invoicing")}>{t("mgmt.invoicing.open")}</Button>
      </div>
    </Card>
  );
}
