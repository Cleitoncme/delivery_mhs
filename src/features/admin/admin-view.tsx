"use client";
import { useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Tags,
  Blocks,
  Users,
  Ticket,
  ChartNoAxesCombined,
  Settings,
  Plug,
  X,
  ArrowRight,
  Search,
} from "lucide-react";
import { useApiResource } from "@/lib/use-api-resource";
import {
  compareOrdersByNumber,
  nextOrderStatus,
  orderStatusNames,
} from "@/lib/order-flow";
import { money } from "@/lib/format";
import type { DeliveryOrderStatus, Order } from "@/types/domain";
const columns: { status: DeliveryOrderStatus; label: string }[] = [
  { status: "NEW", label: "Novos" },
  { status: "PREPARING", label: "Em preparo" },
  { status: "READY", label: "Prontos" },
  { status: "OUT_FOR_DELIVERY", label: "Em entrega" },
  { status: "COMPLETED", label: "Concluídos" },
  { status: "CANCELED", label: "Cancelados" },
];
const nav = [
  LayoutDashboard,
  ClipboardList,
  Package,
  Tags,
  Blocks,
  Users,
  Ticket,
  ChartNoAxesCombined,
  Settings,
  Plug,
];
const names = [
  "Visão geral",
  "Pedidos",
  "Produtos",
  "Categorias",
  "Complementos",
  "Clientes",
  "Cupons",
  "Relatórios",
  "Configurações",
  "Integrações",
];
type OrderPeriod = "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "CUSTOM";
type OrderStatusFilter = "ALL" | DeliveryOrderStatus;
function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
export function AdminView({ initialDate }: { initialDate: string }) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [period, setPeriod] = useState<OrderPeriod>("TODAY");
  const [customDate, setCustomDate] = useState(initialDate);
  const [statusFilter, setStatusFilter] =
    useState<OrderStatusFilter>("ALL");
  const filterDate =
    period === "YESTERDAY"
      ? addDays(initialDate, -1)
      : period === "CUSTOM"
        ? customDate
        : initialDate;
  const queryParams = new URLSearchParams({
    page: String(page),
    date: filterDate,
    days: period === "LAST_7_DAYS" ? "7" : "1",
  });
  if (statusFilter !== "ALL") queryParams.set("status", statusFilter);
  const { data, error, refresh } = useApiResource<{
    orders: Order[];
    hasMore: boolean;
    role: string;
  }>(`/api/admin/pedidos?${queryParams.toString()}`);
  const orders = data?.orders ?? [];
  const [optimisticStatus, setOptimisticStatus] = useState<
    Record<
      string,
      { expected: DeliveryOrderStatus; status: DeliveryOrderStatus }
    >
  >({});
  const visibleOrders = orders.map((order) => {
    const optimistic = optimisticStatus[order.id];
    return {
      ...order,
      status:
        optimistic?.expected === order.status
          ? optimistic.status
          : order.status,
    };
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = visibleOrders.find((order) => order.id === selectedId);
  const [busy, setBusy] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<DeliveryOrderStatus | null>(null);
  const [actionError, setActionError] = useState("");
  const nextStatus =
    selected && nextOrderStatus(selected.status, selected.fulfillmentType);
  async function transitionOrder(
    order: Order,
    status: DeliveryOrderStatus,
    closeDetails = false,
  ) {
    if (busy || nextOrderStatus(order.status, order.fulfillmentType) !== status)
      return;
    setBusy(true);
    setMovingId(order.id);
    setActionError("");
    setOptimisticStatus((current) => ({
      ...current,
      [order.id]: { expected: order.status, status },
    }));
    try {
      const response = await fetch(`/api/admin/pedidos/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedStatus: order.status,
          status,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Falha ao alterar o pedido.");
      if (closeDetails) setSelectedId(null);
    } catch (cause) {
      setOptimisticStatus((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
      setActionError(
        cause instanceof Error ? cause.message : "Falha de conexão.",
      );
    } finally {
      setBusy(false);
      setMovingId(null);
      setDraggedId(null);
      setDropStatus(null);
      refresh();
    }
  }
  async function transition() {
    if (!selected || !nextStatus) return;
    await transitionOrder(selected, nextStatus, true);
  }
  const [query, setQuery] = useState("");
  const visible = visibleOrders.filter((o) =>
    `${o.number} ${o.customer.name}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Link href="/admin" className="brand">
          <span className="brand-mark">
            mhs<span>●</span>
          </span>
        </Link>
        <nav>
          {names.map((name, i) => {
            const Icon = nav[i];
            return (
              <a
                href={
                  name === "Pedidos"
                    ? "#pedidos"
                    : name === "Produtos"
                      ? "/admin/produtos"
                      : name === "Categorias"
                        ? "/admin/categorias"
                        : name === "Complementos"
                          ? "/admin/complementos"
                          : "#"
                }
                className={name === "Pedidos" ? "active" : ""}
                key={name}
              >
                <Icon size={19} />
                {name}
              </a>
            );
          })}
        </nav>
        <small>Gestão de pedidos</small>
      </aside>
      <main id="main" className="admin-main">
        <div className="admin-panel-header">
        <header>
          <div>
            <span className="eyebrow">PAINEL ADMINISTRATIVO</span>
            <h1>Pedidos</h1>
          </div>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const response = await fetch("/api/admin/session", {
                  method: "DELETE",
                });
                if (!response.ok)
                  throw new Error("Não foi possível encerrar a sessão.");
                router.replace("/admin/login");
                router.refresh();
              } catch {
                setActionError("Não foi possível sair. Tente novamente.");
                setBusy(false);
              }
            }}
          >
            Sair
          </button>
        </header>
        <p className="demo-notice">
          Atualização automática a cada 10 segundos.{" "}
          {data?.role === "VIEWER"
            ? "Seu perfil permite somente consulta."
            : "Selecione um pedido para avançar o atendimento."}
        </p>
        {(error || actionError) && (
          <p role="alert" className="field-error">
            {error || actionError}
          </p>
        )}
        {!data && !error && <p role="status">Carregando pedidos…</p>}
        <button onClick={refresh}>Atualizar pedidos</button>
        {data && orders.length === 0 && <p>Nenhum pedido nesta página.</p>}
        <div className="admin-filters">
          <label className="admin-search">
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar nesta página por pedido ou cliente"
              aria-label="Buscar pedidos"
            />
          </label>
          <label className="admin-filter">
            <span>Período</span>
            <select
              aria-label="Filtrar pedidos por período"
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value as OrderPeriod);
                setPage(0);
                setSelectedId(null);
              }}
            >
              <option value="TODAY">Hoje + pendentes</option>
              <option value="YESTERDAY">Ontem + pendentes</option>
              <option value="LAST_7_DAYS">Últimos 7 dias + pendentes</option>
              <option value="CUSTOM">Data específica + pendentes</option>
            </select>
          </label>
          {period === "CUSTOM" && (
            <label className="admin-filter">
              <span>Data</span>
              <input
                type="date"
                aria-label="Data dos pedidos"
                value={customDate}
                max={initialDate}
                onChange={(event) => {
                  setCustomDate(event.target.value);
                  setPage(0);
                  setSelectedId(null);
                }}
              />
            </label>
          )}
          <label className="admin-filter">
            <span>Status</span>
            <select
              aria-label="Filtrar pedidos por status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as OrderStatusFilter);
                setPage(0);
                setSelectedId(null);
              }}
            >
              <option value="ALL">Todos</option>
              {columns.map((column) => (
                <option value={column.status} key={column.status}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        </div>
        <section id="pedidos" className="kanban">
          {columns.map((column) => {
            const list = visible
              .filter((o) => o.status === column.status)
              .sort(compareOrdersByNumber);
            const dragged = visibleOrders.find((order) => order.id === draggedId);
            const acceptsDrop =
              !!dragged &&
              dragged.status !== "NEW" &&
              data?.role === "OPERATOR" &&
              nextOrderStatus(dragged.status, dragged.fulfillmentType) ===
                column.status;
            return (
              <div
                className={`kanban-column${dropStatus === column.status && acceptsDrop ? " drop-target" : ""}`}
                key={column.status}
                data-status={column.status}
                onDragOver={(event) => {
                  if (!acceptsDrop) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropStatus(column.status);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node))
                    setDropStatus(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDropStatus(null);
                  if (dragged && acceptsDrop)
                    void transitionOrder(dragged, column.status);
                }}
              >
                <h2>
                  {column.label}
                  <span>{list.length}</span>
                </h2>
                {list.map((order) => (
                  <button
                    className={`order-card${movingId === order.id ? " moving" : ""}`}
                    key={order.id}
                    draggable={
                      data?.role === "OPERATOR" &&
                      order.status !== "NEW" &&
                      !!nextOrderStatus(order.status, order.fulfillmentType) &&
                      !busy
                    }
                    onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                      if (order.status === "NEW") {
                        event.preventDefault();
                        return;
                      }
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", order.id);
                      setDraggedId(order.id);
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDropStatus(null);
                    }}
                    onClick={() => {
                      setSelectedId(order.id);
                      setActionError("");
                    }}
                  >
                    <strong>#{order.number}</strong>
                    <span>{order.customer.name}</span>
                    <b>{money(order.total)}</b>
                    <small>
                      {new Intl.DateTimeFormat("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(order.createdAt))}
                    </small>
                  </button>
                ))}
              </div>
            );
          })}
        </section>
        {(page > 0 || data?.hasMore) && (
          <nav aria-label="Páginas de pedidos">
            <button
              disabled={page === 0 || busy}
              onClick={() => {
                setPage(page - 1);
                setSelectedId(null);
              }}
            >
              Anterior
            </button>
            <span> Página {page + 1} </span>
            <button
              disabled={!data?.hasMore || busy}
              onClick={() => {
                setPage(page + 1);
                setSelectedId(null);
              }}
            >
              Próxima
            </button>
          </nav>
        )}
      </main>
      {selected && (
        <aside
          className="order-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-title"
        >
          <button
            className="icon-button"
            aria-label="Fechar detalhes"
            onClick={() => setSelectedId(null)}
          >
            <X size={20} />
          </button>
          <span className="eyebrow">PEDIDO</span>
          <h2 id="drawer-title">#{selected.number}</h2>
          <h3>Cliente</h3>
          <p>
            {selected.customer.name}
            <br />
            {selected.customer.phone}
          </p>
          <h3>Entrega</h3>
          <p>
            {selected.fulfillmentType === "DELIVERY" && selected.address
              ? `${selected.address.street}, ${selected.address.number}`
              : "Retirada na loja"}
          </p>
          {selected.address && (
            <p>
              {selected.address.neighborhood} • {selected.address.city}/
              {selected.address.state}
              <br />
              {selected.address.complement} {selected.address.reference}
            </p>
          )}
          <h3>Itens</h3>
          {selected.items.length ? (
            selected.items.map((item) => (
              <p key={item.id}>
                {item.quantity}× {item.productName}{" "}
                <strong>{money(item.total)}</strong>
                {item.selectedOptions.length > 0 && (
                  <small>
                    <br />
                    {item.selectedOptions
                      .map((option) => option.name)
                      .join(", ")}
                  </small>
                )}
              </p>
            ))
          ) : (
            <p>Nenhum item registrado.</p>
          )}
          {selected.notes && (
            <p>
              <strong>Observações:</strong> {selected.notes}
            </p>
          )}
          <div className="drawer-total">
            <span>Total</span>
            <strong>{money(selected.total)}</strong>
          </div>
          <p>
            Pagamento:{" "}
            {selected.paymentMethod === "PIX"
              ? "PIX"
              : selected.paymentMethod === "CASH"
                ? "Dinheiro"
                : "Cartão na entrega"}
          </p>
          {selected.paymentMethod === "CASH" && selected.changeFor != null && (
            <p>Troco para {money(selected.changeFor)}</p>
          )}
          <h3>Histórico</h3>
          <ul>
            {selected.history.map((entry, index) => (
              <li key={index}>
                {orderStatusNames[entry.status]} —{" "}
                {new Date(entry.at).toLocaleString("pt-BR")}
              </li>
            ))}
          </ul>
          {nextStatus && data?.role === "OPERATOR" && (
            <button
              className="wide"
              disabled={busy || !!error}
              onClick={transition}
            >
              {selected.status === "NEW"
                ? "Aceitar pedido"
                : selected.status === "PREPARING"
                  ? "Marcar como pronto"
                  : selected.status === "READY" &&
                      selected.fulfillmentType === "DELIVERY"
                    ? "Saiu para entrega"
                    : "Concluir pedido"}
              <ArrowRight size={17} />
            </button>
          )}
        </aside>
      )}
    </div>
  );
}
