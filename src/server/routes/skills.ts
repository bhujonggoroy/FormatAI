import express from "express";
import { skillRegistry } from "../../skills/index.ts";

export const skillsRouter = express.Router();

// --- Modular Skills Management Endpoints (Stateless) ---
skillsRouter.get("/api/skills", (_req, res) => {
  try {
    res.json({ skills: skillRegistry.getAllSkills() });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list skills." });
  }
});

skillsRouter.post("/api/skills/toggle", (_req, res) => {
  // Stateless: do not mutate shared server skillRegistry; state lives in each request's enabledSkillIds
  res.json({ success: true, skills: skillRegistry.getAllSkills() });
});

skillsRouter.post("/api/skills/reset", (_req, res) => {
  // Stateless: do not mutate shared server skillRegistry; state lives in each request's enabledSkillIds
  res.json({ success: true, skills: skillRegistry.getAllSkills() });
});
