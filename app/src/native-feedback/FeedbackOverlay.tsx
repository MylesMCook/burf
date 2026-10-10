import { Agentation } from "agentation";

export default function FeedbackOverlay({ endpoint }: { endpoint: string }) {
  return <Agentation appName={"burf"} endpoint={endpoint} />;
}
