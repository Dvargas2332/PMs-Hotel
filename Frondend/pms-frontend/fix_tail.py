from pathlib import Path
path = Path("src/modulos/restaurant/RestaurantPage.jsx")
text = path.read_text(encoding="utf-8")
marker = ") : (\n              <div key={`restaurant-pos-"
start = text.find(marker)
if start == -1:
    raise SystemExit("marker not found")
branch = """
) : (
              <div key={`restaurant-pos-${String(selectedTable?.id || "none")}`} className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-y-auto">
                <div className="col-span-2 flex flex-col gap-3 min-h-0">
                  <div className="rounded-2xl bg-white border border-lime-100 shadow-sm p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase text-lime-700">Section / Table</div>
                        <div className="text-sm font-semibold text-lime-900">
                          {selectedSection?.name || "-"} -> {selectedTable?.name || "-"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <input
                          className="h-10 w-full md:w-[260px] rounded-lg border border-lime-200 px-3 text-sm"
                          placeholder="Search item..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                        <button
                          className="h-10 px-3 rounded-lg bg-white text-black text-sm font-semibold border border-black/15 hover:bg-lime-50"
                          onClick={() => setSearch("")}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className={`h-9 px-3 rounded-lg border text-sm font-semibold ${
                          !category ? "bg-lime-200 border-lime-300 text-black" : "bg-white border-black/10 text-black"
                        }`}
                        onClick={() => setCategory("")}
                      >
                        All
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          className={`h-9 px-3 rounded-lg border text-sm font-semibold ${
                            category === cat ? "bg-lime-200 border-lime-300 text-black" : "bg-white border-black/10 text-black"
                          }`}
                          onClick={() => setCategory(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col lg:flex-row gap-4 items-start">
                    <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-2">
                      {filteredMenu.map((item, idx) => (
                        <button
                          key={String(item.id || item.code || `${item.name}-${idx}`)}
                          onClick={() => addItem(item)}
                          className="relative rounded-lg bg-white border-2 border-lime-100 shadow-sm hover:shadow-md transition text-left p-1.5 flex flex-col gap-1.5 aspect-square"
                          style={{
                            borderColor: item?.color ? String(item.color) : undefined,
                          }}
                        >
                          <div className="absolute top-1.5 right-1.5 text-[15px] font-bold text-lime-800 leading-none">
                            {formatMoney(item.price)}
                          </div>

                          {item.imageUrl ? (
                            <>
                              <div className="pr-12 min-w-0 text-[15px] font-semibold text-lime-900 leading-tight line-clamp-2">
                                {item.name}
                              </div>
                              <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-lime-100 bg-white flex items-center justify-center">
                                <img
                                  alt=""
                                  src={item.imageUrl}
                                  className="h-full w-full object-contain p-0"
                                  onError={(ev) => {
                                    ev.currentTarget.style.display = "none";
                                  }}
                                />
                              </div>
                            </>
                          ) : (
                            <div className="flex-1 min-h-0 flex items-center justify-center text-center px-2">
                              <div className="text-[16px] font-semibold text-lime-900 leading-snug line-clamp-3">
                                {item.name}
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="w-full lg:w-[430px] xl:w-[520px] flex-shrink-0 bg-lime-50 border border-lime-200 rounded-2xl shadow p-4 flex flex-col min-h-[420px] max-h-[calc(100vh-180px)] overflow-y-auto order-1 lg:order-2">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-xs uppercase text-lime-700">Order</div>
                          <div className="text-lg font-semibold text-lime-900">
                            {selectedSection ? `${selectedSection.name} - ` : ""}
                            {selectedTable?.name || "No table"}
                          </div>
                          {currentOrder.status && <div className="text-[11px] text-lime-600 mt-1">{currentOrder.status}</div>}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-lime-600">
                          <label className="text-xs text-lime-700">Pax</label>
                          <input
                            type="number"
                            className="w-14 h-9 rounded-lg border border-lime-200 text-center"
                            value={currentOrder.covers || covers}
                            onChange={(e) => handleCoversChange(e.target.value)}
                            min={1}
                          />
                        </div>
                      </div>

                      <textarea
                        className="w-full rounded-lg border border-lime-100 px-3 py-2 text-sm min-h-[70px]"
                        placeholder="Notas para cocina"
                        value={orderNote}
                        onChange={(e) => handleNoteChange(e.target.value)}
                      />

                      <div className="mt-3 space-y-2">
                        <div className="text-xs uppercase text-lime-700">Tipo de servicio</div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: "DINE_IN", label: "Comer aqui" },
                            { id: "TAKEOUT", label: "Takeout" },
                            { id: "DELIVERY", label: "Delivery" },
                            { id: "ROOM", label: "Room charge" },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              className={`h-9 rounded-lg border text-sm font-semibold ${
                                serviceType === opt.id ? "bg-lime-200 border-lime-300 text-black" : "bg-white border-black/10 text-black"
                              }`}
                              onClick={() => handleServiceTypeChange(opt.id)}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {serviceType === "ROOM" && (
                          <input
                            className="w-full h-10 rounded-lg border border-lime-200 px-3 text-sm"
                            placeholder="Room / room charge"
                            value={roomCharge}
                            onChange={(e) => handleRoomChargeChange(e.target.value)}
                          />
                        )}
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs uppercase text-lime-700">Cliente (define FE/TE)</div>
                          <button className="h-9 px-3 rounded-lg bg-white border border-black/15 hover:bg-lime-50 text-sm font-semibold" onClick={() => setShowGuestPicker(true)}>
                            Clientes
                          </button>
                        </div>
                        {selectedGuest ? (
                          <div className="flex items-center justify-between rounded-lg border border-lime-200 bg-lime-50 px-3 py-2 text-sm">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-lime-900 truncate">
                                {`${selectedGuest.firstName || ""} ${selectedGuest.lastName || selectedGuest.company || ""}`.strip() or selectedGuest.email or "Cliente"}
                              </div>
                              {selectedGuest.email and <div className="text-xs text-lime-700 truncate">{selectedGuest.email}</div>}
                            </div>
                            <button className="text-xs text-lime-700 underline" onClick={clearGuest}>
                              Quitar
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-lime-700">Sin cliente seleccionado</div>
                        )}
                      </div>

                      <div className="flex-1 min-h-0 max-h-[50vh] overflow-y-auto space-y-2 pr-1 mt-2">
                        {(currentOrder.items or []).length == 0 and (
                          <div className="text-sm text-black bg-white border border-dashed border-black/15 rounded-xl p-3">
                            Agrega productos con un tap.
                          </div>
                        )}
                      </div>

                      <div className="mt-4 space-y-1 text-sm text-lime-800">
                        <div className="flex justify-between">
                          <span>Sub total</span>
                          <span>{formatMoney(totals.subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Service {taxesCfg.servicio || 0}%</span>
                          <span>{formatMoney(totals.service)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Taxes {taxesCfg.iva || 0}%</span>
                          <span>{formatMoney(totals.tax)}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-lg mt-1">
                          <span>Total</span>
                          <span>{formatMoney(totals.total)}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] text-black">
                        <div>Tax included in prices: {taxesCfg.impuestoIncluido ? "Yes" : "No"}</div>
                        <div>Discounts: {taxesCfg.permitirDescuentos ? "Enabled" : "Disabled"} - Max {taxesCfg.descuentoMax ?? 0}%</div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 sticky bottom-0 bg-gradient-to-r from-lime-50 via-emerald-50 to-lime-50 pt-3 pb-1 border-t border-lime-200/60">
                        <button className="h-12 rounded-xl bg-lime-100 text-lime-800 font-semibold border border-lime-200 disabled:opacity-60" onClick={sendToKitchen} disabled={!hasItems}>
                          Comanda
                        </button>
                        <button
                          className="h-12 rounded-xl bg-white border border-emerald-200 text-black font-semibold hover:bg-lime-50 disabled:opacity-60"
                          onClick={reprintComanda}
                          disabled={!hasItems}
                          title="Reprint comanda without re-sending to kitchen/KDS"
                        >
                          Reprint comanda
                        </button>
                        <button className="h-12 rounded-xl bg-rose-50 text-rose-800 font-semibold border border-rose-200 hover:bg-rose-100 disabled:opacity-60" onClick={openPayments} disabled={!hasItems}>
                          Cobrar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
      </div>
    </div>
  );
}
"""
path.write_text(text[:start] + branch, encoding="utf-8")
