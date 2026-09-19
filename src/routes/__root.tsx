import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { Cat, Package, Layers, Database, Camera } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRoute({
    component: RootLayout,
});

const tabs = [
    { to: "/", label: "Storage", Icon: Package },
    { to: "/cats", label: "Cats", Icon: Cat },
    { to: "/sets", label: "Sets", Icon: Layers },
    { to: "/import", label: "Import", Icon: Camera },
    { to: "/data", label: "Data", Icon: Database },
] as const;

function RootLayout() {
    return (
        <div className="min-h-screen bg-stone-100 text-stone-900">
            <header className="sticky top-0 z-50 flex flex-wrap items-center gap-2 border-b border-stone-300 bg-white px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                <p className="m-0 flex items-center gap-1.5 text-sm font-semibold sm:text-base">
                    <Cat className="size-5 text-stone-700" aria-hidden />
                    <span>Mewgenics Hoard</span>
                </p>
                <div className="grow" />
                <nav className="flex gap-1" aria-label="Main navigation">
                    {tabs.map((t) => (
                        <Link
                            key={t.to}
                            to={t.to}
                            activeOptions={{ exact: t.to === "/" }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1.5 text-xs text-stone-500 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 sm:px-3 sm:text-sm"
                            activeProps={{
                                className:
                                    "inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-stone-100 px-2.5 py-1.5 text-xs font-medium text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 sm:px-3 sm:text-sm",
                            }}
                        >
                            <t.Icon className="size-4" aria-hidden />
                            <span className="hidden sm:inline">{t.label}</span>
                        </Link>
                    ))}
                </nav>
            </header>
            <main className="mx-auto max-w-[1400px] p-3 sm:p-4">
                <Outlet />
            </main>
            <Toaster richColors position="top-center" />
        </div>
    );
}
