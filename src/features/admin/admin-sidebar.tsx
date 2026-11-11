import Link from "next/link";
import {
  Blocks,
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  Package,
  Plug,
  Settings,
  Tags,
  Ticket,
  Users,
} from "lucide-react";

const items = [
  { label: "Visão geral", href: "/admin", icon: LayoutDashboard },
  { label: "Pedidos", href: "/admin/pedidos", icon: ClipboardList },
  { label: "Produtos", href: "/admin/produtos", icon: Package },
  { label: "Categorias", href: "/admin/categorias", icon: Tags },
  { label: "Complementos", href: "/admin/complementos", icon: Blocks },
  { label: "Clientes", href: "/admin/clientes", icon: Users },
  { label: "Cupons", href: "/admin/cupons", icon: Ticket },
  { label: "Relatórios", href: "/admin/relatorios", icon: ChartNoAxesCombined },
  { label: "Configurações", href: "/admin/configuracoes", icon: Settings },
  { label: "Integrações", href: "/admin/integracoes", icon: Plug },
] as const;

export function AdminSidebar({ active }: { active: string }) {
  return (
    <aside className="admin-sidebar">
      <Link href="/admin" className="brand">
        <span className="brand-mark">
          mhs<span>●</span>
        </span>
      </Link>
      <nav aria-label="Navegação administrativa">
        {items.map(({ label, href, icon: Icon }) => (
          <Link
            href={href}
            className={label === active ? "active" : ""}
            aria-current={label === active ? "page" : undefined}
            key={label}
          >
            <Icon size={19} />
            {label}
          </Link>
        ))}
      </nav>
      <small>Gestão da loja</small>
    </aside>
  );
}
