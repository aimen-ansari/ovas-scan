import { createFileRoute } from "@tanstack/react-router";
import { AnalysisWorkspace } from "@/components/analysis/AnalysisWorkspace";
export const Route = createFileRoute("/_authenticated/upload")({component:AnalysisWorkspace});
