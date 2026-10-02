import { ArrowRightIcon, LaptopIcon, ServerIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// WelcomeStep says what Berth is in a line, and what the next minutes hold.
export function WelcomeStep({ onNext }: { onNext(): void }) {
  return (
    <div>
      <Diagram />
      <h1 className="mt-8 font-semibold text-2xl tracking-tight">Welcome to Berth</h1>
      <p className="mt-2 text-muted-foreground leading-relaxed">
        Your agents run on your own boxes, any VPS or dev machine, and keep running when this laptop sleeps, loses Wi-Fi or closes the app. Berth is how you watch them, talk to them and open what they build.
      </p>
      <ol className="mt-6 space-y-2 text-sm">
        {["Connect a box", "Add a repo on it", "Start your first agent"].map((s, i) => (
          <li key={s} className="flex items-center gap-3 text-muted-foreground">
            <span className="flex size-5 items-center justify-center rounded-full border font-mono text-[10px]">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <Button className="mt-8" onClick={onNext}>
        Connect a box <ArrowRightIcon />
      </Button>
    </div>
  );
}

// Diagram: this laptop, a line, and the boxes the agents live on.
function Diagram() {
  return (
    <div className="flex items-center gap-3 text-muted-foreground">
      <span className="flex size-10 items-center justify-center rounded-xl border bg-card">
        <LaptopIcon className="size-5" />
      </span>
      <span className="h-px w-16 bg-gradient-to-r from-border via-foreground/40 to-border" />
      <span className="flex -space-x-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex size-10 items-center justify-center rounded-xl border bg-card shadow-sm" style={{ zIndex: 3 - i }}>
            <ServerIcon className="size-4.5" />
          </span>
        ))}
      </span>
    </div>
  );
}
