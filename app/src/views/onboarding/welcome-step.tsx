import { ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// WelcomeStep says what Berth is in a line, and what the next minutes hold.
export function WelcomeStep({ onNext }: { onNext(): void }) {
  return (
    <div>
      {/* The title starts where every step's does; the scene (dawn) is the
          page's, above the progress. */}
      <h1 className="font-semibold text-2xl tracking-tight">Welcome to Berth</h1>
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
      <Button className="mt-8" autoFocus onClick={onNext}>
        Connect a box <ArrowRightIcon />
      </Button>
    </div>
  );
}
