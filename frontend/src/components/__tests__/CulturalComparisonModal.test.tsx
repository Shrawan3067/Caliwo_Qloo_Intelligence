import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import CulturalComparisonModal from "../CulturalComparisonModal";

describe("CulturalComparisonModal Component", () => {
  it("renders side-by-side comparison with Culturally Blind AI vs. Qloo Attuned columns", () => {
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      <CulturalComparisonModal
        visible={true}
        onClose={onClose}
        initialPersonaId="alex"
      />
    );

    expect(getByTestId("cultural-comparison-modal")).toBeTruthy();
    expect(getByTestId("comparison-blind-column")).toBeTruthy();
    expect(getByTestId("comparison-qloo-column")).toBeTruthy();

    // Verify Blind AI column elements
    expect(getByText("WITHOUT QLOO (GENERIC LLM)")).toBeTruthy();
    expect(getByText("0% CULTURAL FIT")).toBeTruthy();
    expect(getByText("High Abandonment Risk")).toBeTruthy();
    expect(getByText("Boiled Chicken Breast, White Rice & Steamed Broccoli")).toBeTruthy();

    // Verify Qloo column elements for Alex
    expect(getByText("CALIWO + QLOO TASTE GRAPH")).toBeTruthy();
    expect(getByText("96% BIO-MATCH")).toBeTruthy();
    expect(getByText("Saikyo Sweet Miso-Glazed Salmon & Forbidden Rice")).toBeTruthy();
    expect(getByText("✨ 95mg Bio-Magnesium (Target Hit)")).toBeTruthy();
  });

  it("switches to Elena and renders Amalfi coast & ancient farro comparison", () => {
    const onSelectPersona = jest.fn();
    const { getByTestId, getByText } = render(
      <CulturalComparisonModal
        visible={true}
        onClose={jest.fn()}
        initialPersonaId="alex"
        onSelectPersona={onSelectPersona}
      />
    );

    // Tap Elena's pill
    fireEvent.press(getByTestId("comparison-persona-elena"));
    expect(onSelectPersona).toHaveBeenCalledWith("elena");

    // Elena's Qloo dish
    expect(getByText("Pan-Seared Sea Bass with Ancient Farro & Kalamata Olives")).toBeTruthy();
    expect(getByText("95% BIO-MATCH")).toBeTruthy();
    expect(getByText("✨ 85mg Bio-Magnesium (Target Hit)")).toBeTruthy();
  });

  it("switches to Marcus and renders Oaxacan smoke & guajillo steak comparison", () => {
    const onSelectPersona = jest.fn();
    const { getByTestId, getByText } = render(
      <CulturalComparisonModal
        visible={true}
        onClose={jest.fn()}
        initialPersonaId="alex"
        onSelectPersona={onSelectPersona}
      />
    );

    // Tap Marcus's pill
    fireEvent.press(getByTestId("comparison-persona-marcus"));
    expect(onSelectPersona).toHaveBeenCalledWith("marcus");

    // Marcus's Qloo dish
    expect(getByText("Oaxacan Braised Guajillo Flank Steak & Charred Poblanos")).toBeTruthy();
    expect(getByText("94% BIO-MATCH")).toBeTruthy();
    expect(getByText("✨ 110mg Bio-Magnesium (Target Hit)")).toBeTruthy();
  });

  it("calls onClose when close button or done button is tapped", () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <CulturalComparisonModal
        visible={true}
        onClose={onClose}
        initialPersonaId="alex"
      />
    );

    fireEvent.press(getByTestId("comparison-modal-close-btn"));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId("comparison-modal-done-btn"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
