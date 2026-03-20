import React from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { useLanguage } from "../../../context/LanguageContext";

export default function ChannelManager() {
  const { t } = useLanguage();
  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-semibold text-lg">{t("mgmt.channelManager.title")}</h3>
      <p className="text-sm text-gray-600">{t("mgmt.channelManager.subtitle")}</p>
      <div className="grid md:grid-cols-2 gap-3">
        <Input placeholder={t("mgmt.channelManager.provider")} />
        <Input placeholder={t("mgmt.channelManager.apiKey")} />
        <Input placeholder={t("mgmt.channelManager.apiSecret")} />
        <Input placeholder={t("mgmt.channelManager.hotelCode")} />
      </div>
      <Button>{t("mgmt.channelManager.save")}</Button>
    </Card>
  );
}
