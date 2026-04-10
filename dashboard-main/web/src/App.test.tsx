import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders dashboard", () => {
  render(<App />);
  const logoElement = screen.getByAltText("Slide");
  expect(logoElement).toBeInTheDocument();
});
