import { ArrowRightIcon } from "lucide-react";

import { Scene } from "@/components/art/scenes";
import { Button } from "@/components/ui/button";

// WelcomeStep says what Berth is in a line, and what the next minutes hold.
export function WelcomeStep({ onNext }: { onNext(): void }) {
  return (
    <div>
      {/* An empty harbour at first light: nothing here yet, and a start. */}
      <Scene name="dawn" width={152} className="-ml-1" />
      <h1 className="mt-6 font-semibold text-2xl tracking-tight">Welcome to Berth</h1>
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
