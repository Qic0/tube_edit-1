import { NavLink } from "@/components/NavLink";
import { Wrench, Scissors } from "lucide-react";

export function MainNav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Scissors className="h-4 w-4" />
            </div>
            <span className="hidden font-bold sm:inline-block">
              Калькулятор резки
            </span>
          </div>
        </div>
        <nav className="flex items-center space-x-6 text-sm font-medium">
          <NavLink
            to="/"
            end
            className="transition-colors hover:text-foreground/80 text-foreground/60"
            activeClassName="text-foreground"
          >
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span>Труборез</span>
            </div>
          </NavLink>
          <NavLink
            to="/dxf"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
            activeClassName="text-foreground"
          >
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              <span>Листовая резка</span>
            </div>
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
