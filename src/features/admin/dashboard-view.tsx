"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ReceiptText,
  TrendingUp,
} from "lucide-react";
import { AdminSidebar } from "./admin-sidebar";
import { useApiResource } from "@/lib/use-api-resource";
import { money } from "@/lib/format";
import { orderStatusNames } from "@/lib/order-flow";
import type { DashboardData } from "@/services/dashboard-reader";

type Period = "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "CUSTOM";
function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function DashboardView({ initialDate }: { initialDate: string }) {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("TODAY");
  const [customDate, setCustomDate] = useState(initialDate);
  const [logoutError, setLogoutError] = useState("");
  const date =
    period === "YESTERDAY"
      ? addDays(initialDate, -1)
      : period === "CUSTOM"
        ? customDate
        : initialDate;
  const days = period === "LAST_7_DAYS" ? 7 : 1;
  const { data, error, refresh } = useApiResource<DashboardData>(
    `/api/admin/dashboard?date=${date}&days=${days}`,
    30000,
  );
  const maxRevenue = Math.max(
    1,
    ...(data?.series.map((item) => item.revenue) ?? []),
  );
  const activeOrders = data
    ? data.statusCounts.NEW +
      data.statusCounts.PREPARING +
      data.statusCounts.READY +
      data.statusCounts.OUT_FOR_DELIVERY
    : 0;

  return (
    <div className="admin-layout dashboard-layout">
      <AdminSidebar active="Visão geral" />
      <main id="main" className="admin-main dashboard-main">
        <header className="dashboard-header">
          <div>
            <span className="eyebrow">PAINEL ADMINISTRATIVO</span>
            <h1>Visão geral</h1>
            <p>Acompanhe vendas e a operação da loja.</p>
          </div>
          <button
            onClick={async () => {
              setLogoutError("");
              const response = await fetch("/api/admin/session", {
                method: "DELETE",
              });
              if (!response.ok) {
                setLogoutError("Não foi possível sair. Tente novamente.");
                return;
              }
              router.replace("/admin/login");
              router.refresh();
            }}
          >
            Sair
          </button>
        </header>
        <div className="dashboard-toolbar">
          <label className="admin-filter">
            <span>Período</span>
            <select
              aria-label="Período do dashboard"
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
            >
              <option value="TODAY">Hoje</option>
              <option value="YESTERDAY">Ontem</option>
              <option value="LAST_7_DAYS">Últimos 7 dias</option>
              <option value="CUSTOM">Data específica</option>
            </select>
          </label>
          {period === "CUSTOM" && (
            <label className="admin-filter">
              <span>Data</span>
              <input
                type="date"
                aria-label="Data do dashboard"
                value={customDate}
                max={initialDate}
                onChange={(event) => setCustomDate(event.target.value)}
              />
            </label>
          )}
          <button className="secondary-button" onClick={refresh}>
            Atualizar dados
          </button>
        </div>
        {(error || logoutError) && (
          <p role="alert" className="field-error">
            {error || logoutError}
          </p>
        )}
        {!data && !error ? (
          <p role="status">Carregando indicadores…</p>
        ) : data ? (
          <>
            <section
              className="dashboard-kpis"
              aria-label="Indicadores do período"
            >
              <article>
                <span>
                  <Banknote size={19} /> Faturamento
                </span>
                <strong>{money(data.summary.revenue)}</strong>
                <small>Somente pedidos concluídos</small>
              </article>
              <article>
                <span>
                  <CheckCircle2 size={19} /> Pedidos concluídos
                </span>
                <strong>{data.summary.completedOrders}</strong>
                <small>{data.summary.totalOrders} recebidos no período</small>
              </article>
              <article>
                <span>
                  <ReceiptText size={19} /> Ticket médio
                </span>
                <strong>{money(data.summary.averageTicket)}</strong>
                <small>Por pedido concluído</small>
              </article>
              <article>
                <span>
                  <AlertTriangle size={19} /> Cancelamentos
                </span>
                <strong>{data.summary.canceledOrders}</strong>
                <small>{data.summary.cancellationRate}% dos recebidos</small>
              </article>
            </section>
            <div className="dashboard-grid">
              <section
                className="dashboard-panel dashboard-chart"
                aria-labelledby="sales-title"
              >
                <div className="dashboard-panel-title">
                  <div>
                    <span className="eyebrow">DESEMPENHO</span>
                    <h2 id="sales-title">Vendas por dia</h2>
                  </div>
                  <TrendingUp size={22} />
                </div>
                <div className="sales-bars">
                  {data.series.map((item) => (
                    <div className="sales-bar" key={item.date}>
                      <span>{money(item.revenue)}</span>
                      <div
                        style={{
                          height: `${Math.max(4, (item.revenue / maxRevenue) * 100)}%`,
                        }}
                        title={`${item.orders} pedidos concluídos`}
                      />
                      <small>
                        {new Intl.DateTimeFormat("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          timeZone: "UTC",
                        }).format(new Date(`${item.date}T12:00:00Z`))}
                      </small>
                    </div>
                  ))}
                </div>
              </section>
              <section
                className="dashboard-panel"
                aria-labelledby="operation-title"
              >
                <div className="dashboard-panel-title">
                  <div>
                    <span className="eyebrow">AGORA</span>
                    <h2 id="operation-title">Operação</h2>
                  </div>
                  <ClipboardList size={22} />
                </div>
                <strong className="active-total">{activeOrders} pedidos ativos</strong>
                <dl className="status-summary">
                  {(
                    [
                      ["NEW", "Novos"],
                      ["PREPARING", "Em preparo"],
                      ["READY", "Prontos"],
                      ["OUT_FOR_DELIVERY", "Em entrega"],
                    ] as const
                  ).map(([status, label]) => (
                    <div key={status}>
                      <dt>{label}</dt>
                      <dd>{data.statusCounts[status]}</dd>
                    </div>
                  ))}
                </dl>
                <Link className="text-link" href="/admin/pedidos">
                  Abrir painel de pedidos →
                </Link>
              </section>
              <section
                className="dashboard-panel"
                aria-labelledby="recent-title"
              >
                <div className="dashboard-panel-title">
                  <div>
                    <span className="eyebrow">ATUALIZAÇÕES</span>
                    <h2 id="recent-title">Pedidos recentes</h2>
                  </div>
                  <Clock3 size={22} />
                </div>
                {data.recentOrders.length ? (
                  <ul className="recent-orders">
                    {data.recentOrders.map((order) => (
                      <li key={order.id}>
                        <div>
                          <strong>#{order.number}</strong>
                          <span>{order.customerName}</span>
                        </div>
                        <div>
                          <strong>{money(order.total)}</strong>
                          <span>{orderStatusNames[order.status]}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Nenhum pedido no período.</p>
                )}
              </section>
              <section
                className="dashboard-panel"
                aria-labelledby="alerts-title"
              >
                <div className="dashboard-panel-title">
                  <div>
                    <span className="eyebrow">ATENÇÃO</span>
                    <h2 id="alerts-title">Alertas operacionais</h2>
                  </div>
                  <AlertTriangle size={22} />
                </div>
                <div className="operational-alerts">
                  <p>
                    <strong>{data.alerts.waiting}</strong>
                    <span>Novos aguardando há mais de 10 min</span>
                  </p>
                  <p>
                    <strong>{data.alerts.preparing}</strong>
                    <span>Em preparo há mais de 30 min</span>
                  </p>
                </div>
              </section>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
