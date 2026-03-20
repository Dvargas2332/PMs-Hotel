import React from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { useLanguage } from "../../../context/LanguageContext";

export default function AccountingConfig() {
  const { t } = useLanguage();
  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-semibold text-lg">{t("mgmt.accountingConfig.title")}</h3>
      <p className="text-sm text-gray-600">{t("mgmt.accountingConfig.subtitle")}</p>
      <div className="grid md:grid-cols-2 gap-3">
        <Input placeholder={t("mgmt.accountingConfig.cashAccount")} />
        <Input placeholder={t("mgmt.accountingConfig.bankAccount")} />
        <Input placeholder={t("mgmt.accountingConfig.journalPrefix")} />
        <Input placeholder={t("mgmt.accountingConfig.costCenter")} />
      </div>
      <Button>{t("mgmt.accountingConfig.save")}</Button>
    </Card>
  );
}
