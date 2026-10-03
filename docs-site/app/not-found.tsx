import Link from 'next/link';
import { Scene } from '@/components/art/scenes';

// Every path is under the docs' catch-all route, so this renders inside the
// docs layout, sidebar and all.
export default function NotFound() {
  return (
    <main className="berth-not-found [grid-area:main]">
      <Scene name="ended" width={220} />
      <p className="berth-not-found-code">404</p>
      <h1>This berth is empty.</h1>
      <p>Whatever was moored here has left, or never arrived. The page may have moved when the docs were reorganised.</p>
      <div className="berth-not-found-links">
        <Link href="/">Introduction</Link>
        <Link href="/getting-started/install">Install</Link>
        <Link href="/reference/cli">CLI reference</Link>
      </div>
    </main>
  );
}
