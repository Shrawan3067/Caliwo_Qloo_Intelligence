import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { AgentTelemetryBadge, AgentTelemetry } from "../AgentTelemetryBadge";

describe("AgentTelemetryBadge Component", () => {
  const mockTelemetryAlex: AgentTelemetry = {
    tools_called: [
      "get_biometrics_and_macro_gaps",
      "query_qloo_taste_graph",
      "synthesize_culturally_aligned_recipe",
    ],
    execution_trace: [
      "[1] Tool Executed: get_biometrics_and_macro_gaps -> Remaining: 58g Protein, 235mg Magnesium",
      "[2] Tool Executed: query_qloo_taste_graph -> Correlated Cinema (Jiro) + Music (Chet Baker) -> Tokyo/Nobu Dining",
      "[3] Tool Executed: synthesize_culturally_aligned_recipe -> Calibrated Miso Black Cod to hit 48g protein deficit under 650 kcal",
      "[4] Verified Bio-Cultural Alignment: 96% (60% Cultural + 40% Macro Precision)",
    ],
    bio_cultural_score: 96,
    cultural_anchors: ["Nobu", "Jiro Dreams of Sushi", "Tokyo", "Chet Baker"],
    synthesized_recipe: {
      dish_name: "Saikyo Sweet Miso-Glazed Salmon Bowl",
      cuisine: "Japanese",
      calories: 648,
      protein_g: 48,
      magnesium_mg: 95,
      verified_alignment_score: 96,
    },
  };

  it("renders collapsed initially with live trace pill and tool execution pills", () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <AgentTelemetryBadge telemetry={mockTelemetryAlex} />
    );

    expect(getByTestId("agent-telemetry-badge")).toBeTruthy();
    expect(getByText("Autonomous Agent Loop Executed")).toBeTruthy();
    expect(getByText("Live Trace")).toBeTruthy();
    expect(getByText("get biometrics and macro gaps")).toBeTruthy();
    expect(getByText("query qloo taste graph")).toBeTruthy();
    expect(getByText("synthesize culturally aligned recipe")).toBeTruthy();

    // Trace container should not be visible before tapping
    expect(queryByTestId("agent-telemetry-trace-container")).toBeNull();
  });

  it("expands full 4-step autonomous reasoning log when tapped", () => {
    const { getByTestId, getByText } = render(
      <AgentTelemetryBadge telemetry={mockTelemetryAlex} />
    );

    // Tap to expand
    fireEvent.press(getByTestId("agent-telemetry-toggle-btn"));

    // Verify trace container is opened
    expect(getByTestId("agent-telemetry-trace-container")).toBeTruthy();
    expect(getByText("LIVE REASONING EXECUTION LOG")).toBeTruthy();

    // Verify the 4 exact autonomous execution trace steps
    expect(getByTestId("telemetry-trace-step-1")).toBeTruthy();
    expect(getByText("get_biometrics_and_macro_gaps")).toBeTruthy();
    expect(getByText("↳ Remaining: 58g Protein, 235mg Magnesium")).toBeTruthy();

    expect(getByTestId("telemetry-trace-step-2")).toBeTruthy();
    expect(getByText("query_qloo_taste_graph")).toBeTruthy();
    expect(getByText("↳ Correlated Cinema (Jiro) + Music (Chet Baker) -> Tokyo/Nobu Dining")).toBeTruthy();

    expect(getByTestId("telemetry-trace-step-3")).toBeTruthy();
    expect(getByText("synthesize_culturally_aligned_recipe")).toBeTruthy();
    expect(getByText("↳ Calibrated Miso Black Cod to hit 48g protein deficit under 650 kcal")).toBeTruthy();

    expect(getByTestId("telemetry-trace-step-4")).toBeTruthy();
    expect(getByText("Verified Bio-Cultural Alignment")).toBeTruthy();
    expect(getByText("↳ 96% (60% Cultural + 40% Macro Precision)")).toBeTruthy();
  });

  it("collapses when toggle button is pressed again", () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <AgentTelemetryBadge telemetry={mockTelemetryAlex} />
    );

    // Expand
    fireEvent.press(getByTestId("agent-telemetry-toggle-btn"));
    expect(getByTestId("agent-telemetry-trace-container")).toBeTruthy();
    expect(getByText("Hide Log")).toBeTruthy();

    // Collapse
    fireEvent.press(getByTestId("agent-telemetry-toggle-btn"));
    expect(queryByTestId("agent-telemetry-trace-container")).toBeNull();
    expect(getByText("Live Trace")).toBeTruthy();
  });

  it("generates fallback autonomous execution trace when backend trace is omitted", () => {
    const telemetryWithoutTrace: AgentTelemetry = {
      tools_called: ["get_biometrics_and_macro_gaps", "query_qloo_taste_graph", "synthesize_culturally_aligned_recipe"],
      bio_cultural_score: 96,
      cultural_anchors: ["Nobu", "Jiro Dreams of Sushi"],
      synthesized_recipe: {
        dish_name: "Saikyo Sweet Miso-Glazed Salmon Bowl",
        calories: 650,
        protein_g: 48,
        magnesium_mg: 95,
      },
    };

    const { getByTestId, getByText } = render(
      <AgentTelemetryBadge telemetry={telemetryWithoutTrace} />
    );

    fireEvent.press(getByTestId("agent-telemetry-toggle-btn"));
    expect(getByTestId("agent-telemetry-trace-container")).toBeTruthy();
    expect(getByText("get_biometrics_and_macro_gaps")).toBeTruthy();
    expect(getByText("query_qloo_taste_graph")).toBeTruthy();
    expect(getByText("synthesize_culturally_aligned_recipe")).toBeTruthy();
  });

  it("displays culturally blind bypass trace when blind mode is active", () => {
    const blindTelemetry: AgentTelemetry = {
      tools_called: ["culturally_blind_ai_bypass", "get_biometrics_and_macro_gaps"],
      bio_cultural_score: 0,
      blind_mode: true,
      cultural_anchors: ["Generic Bro-Diet"],
      synthesized_recipe: {
        dish_name: "Plain Boiled Chicken Breast & Rice",
        calories: 520,
        protein_g: 48,
      },
    };

    const { getByTestId, getByText } = render(
      <AgentTelemetryBadge telemetry={blindTelemetry} />
    );

    fireEvent.press(getByTestId("agent-telemetry-toggle-btn"));
    expect(getByTestId("agent-telemetry-trace-container")).toBeTruthy();
    expect(getByText("culturally_blind_ai_bypass")).toBeTruthy();
    expect(getByText(/High Abandonment Risk/)).toBeTruthy();
  });
});
