"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Phone, Search, UserRound } from "lucide-react";
import { AdminSidebar } from "./admin-sidebar";
import { useApiResource } from "@/lib/use-api-resource";
import { money } from "@/lib/format";
import { orderStatusNames } from "@/lib/order-flow";
import type { CustomerDetailData, CustomerListData } from "@/services/customer-reader";

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export function CustomersView() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
  const [orderPage, setOrderPage] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(input.trim()); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [input]);
  const list = useApiResource<CustomerListData>(
    `/api/admin/clientes?page=${page}&q=${encodeURIComponent(search)}`,
    30_000,
  );
  const detail = useApiResource<CustomerDetailData>(
    selectedId ? `/api/admin/clientes/${selectedId}?page=${orderPage}` : null,
    30_000,
  );
  const selected = selectedId ? detail.data : undefined;

  return (
    <div className="admin-layout customers-layout">
      <AdminSidebar active="Clientes" />
      <main id="main" className="admin-main customers-main">
        <header className="dashboard-header">
          <div><span className="eyebrow">RELACIONAMENTO</span><h1>Clientes</h1><p>Consulte contatos, endereços e o histórico de pedidos da sua loja.</p></div>
        </header>
        <label className="admin-search customers-search">
          <Search size={18} /><span className="sr-only">Buscar clientes</span>
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Buscar por nome, telefone ou e-mail" />
        </label>
        {list.error && <p className="field-error" role="alert">{list.error}</p>}
        <div className="customers-content">
          <section className="customers-list" aria-label="Lista de clientes">
            {!list.data && !list.error ? <p role="status">Carregando clientes…</p> : null}
            {list.data?.customers.length === 0 ? <p>Nenhum cliente encontrado.</p> : null}
            {list.data?.customers.map((customer) => (
              <button type="button" className={customer.id === selectedId ? "customer-row active" : "customer-row"} aria-pressed={customer.id === selectedId}
                onClick={() => { setSelectedId(customer.id); setOrderPage(0); }} key={customer.id}>
                <span className="customer-avatar"><UserRound size={20} /></span>
                <span className="customer-identity"><strong>{customer.name}</strong><small>{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</small></span>
                <span className="customer-metric"><strong>{customer.orderCount}</strong><small>pedidos</small></span>
                <span className="customer-metric"><strong>{money(customer.totalSpent)}</strong><small>compras concluídas</small></span>
              </button>
            ))}
            {list.data && (page > 0 || list.data.hasMore) ? (
              <nav className="customer-pagination" aria-label="Páginas de clientes">
                {page > 0 && <button className="secondary-button" onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /> Anterior</button>}
                <span>Página {page + 1}</span>
                {list.data.hasMore && <button className="secondary-button" onClick={() => setPage((value) => value + 1)}>Próxima <ChevronRight size={16} /></button>}
              </nav>
            ) : null}
          </section>
          <aside className="customer-detail" aria-label="Detalhes do cliente">
            {!selectedId ? (
              <div className="customer-placeholder"><UserRound size={32} /><strong>Selecione um cliente</strong><span>Os detalhes e pedidos aparecerão aqui.</span></div>
            ) : detail.error ? <p className="field-error" role="alert">{detail.error}</p> : !selected ? <p role="status">Carregando histórico…</p> : (
              <>
                <div className="customer-detail-heading"><span className="customer-avatar"><UserRound size={22} /></span><div><h2>{selected.customer.name}</h2><small>Cliente desde {dateTime(selected.customer.createdAt)}</small></div></div>
                <div className="customer-contact"><span><Phone size={16} /> {selected.customer.phone}</span>{selected.customer.email && <span>{selected.customer.email}</span>}</div>
                <dl className="customer-summary">
                  <div><dt>Pedidos</dt><dd>{selected.summary.orderCount}</dd></div><div><dt>Total gasto</dt><dd>{money(selected.summary.totalSpent)}</dd></div>
                  <div><dt>Ticket médio</dt><dd>{money(selected.summary.averageTicket)}</dd></div><div><dt>Cancelados</dt><dd>{selected.summary.canceledOrders}</dd></div>
                </dl>
                <section className="customer-section"><h3><MapPin size={17} /> Endereços usados</h3>
                  {selected.addresses.length ? selected.addresses.map((address) => <address key={address.id}>{address.street}, {address.number}{address.complement ? `, ${address.complement}` : ""}<br />{address.neighborhood} · {address.city}/{address.state} · CEP {address.zipCode}</address>) : <p>Nenhum endereço cadastrado (somente retirada).</p>}
                </section>
                <section className="customer-section"><h3>Histórico de pedidos</h3>
                  <ul className="customer-orders">{selected.orders.map((order) => <li key={order.id}><span><strong>#{order.number}</strong><small>{dateTime(order.createdAt)} · {order.fulfillmentType === "DELIVERY" ? "Entrega" : "Retirada"}</small></span><span><strong>{money(order.total)}</strong><small>{orderStatusNames[order.status]}</small></span></li>)}</ul>
                  {orderPage > 0 || selected.hasMoreOrders ? <nav className="customer-pagination" aria-label="Páginas do histórico de pedidos">
                    {orderPage > 0 && <button className="secondary-button" onClick={() => setOrderPage((value) => value - 1)}><ChevronLeft size={16} /> Anterior</button>}<span>Página {orderPage + 1}</span>{selected.hasMoreOrders && <button className="secondary-button" onClick={() => setOrderPage((value) => value + 1)}>Próxima <ChevronRight size={16} /></button>}
                  </nav> : null}
                </section>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
