---
name: skill-creator
description: >
  Create new skills, modify and improve existing skills. Use when users want to create a
  skill from scratch, edit an existing skill, or improve a skill's effectiveness. Walks
  through: capture intent → interview → write SKILL.md → create test cases → run tests →
  evaluate → iterate. Includes guidance on description optimization for better triggering.
  Phrases: "create a skill", "make a skill", "I want this as a skill", "improve this skill",
  "edit this skill", "optimize skill description".
---

# Skill Creator

A skill for creating new skills and iteratively improving them.

At a high level, the process of creating a skill goes like this:

- Decide what you want the skill to do and roughly how it should do it
- Write a draft of the skill
- Create a few test prompts and run them with skill access
- Evaluate the results both qualitatively and quantitatively
- Rewrite the skill based on feedback
- Repeat until you're satisfied

Your job when using this skill is to figure out where the user is in this process and then jump in and help them progress through these stages.

## Communicating with the user

Users may range from experienced developers to newcomers exploring terminals for the first time. Pay attention to context cues to understand how to phrase your communication. It's OK to briefly explain terms if in doubt.

## Creating a skill

### Capture Intent

Start by understanding the user's intent. The current conversation might already contain a workflow the user wants to capture. If so, extract answers from the conversation history first — the tools used, the sequence of steps, corrections the user made, input/output formats observed.

1. What should this skill enable?
2. When should this skill trigger? (what user phrases/contexts)
3. What's the expected output format?
4. Should we set up test cases to verify the skill works?

### Interview and Research

Proactively ask questions about edge cases, input/output formats, example files, success criteria, and dependencies. Research best practices and similar skills in parallel.

### Write the SKILL.md

Based on the user interview, fill in these components:

- **name**: Skill identifier (lowercase, hyphen-separated)
- **description**: When to trigger, what it does. Make descriptions slightly "pushy" to combat under-triggering. Include both what the skill does AND specific contexts for when to use it.
- **Metadata**: license, compatibility, metadata fields as needed
- **Body**: Markdown instructions for the skill

### Skill Structure

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description required)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/    - Executable code for deterministic/repetitive tasks
    ├── references/ - Docs loaded into context as needed
    └── assets/     - Templates, icons, fonts
```

### Writing Patterns

- Keep SKILL.md under 500 lines
- Use progressive disclosure: metadata → SKILL.md body → bundled resources
- Prefer imperative form in instructions
- Include examples showing input/output
- Explain the "why" behind instructions
- Reference files clearly with guidance on when to read them

## Iterating on the skill

1. Create test cases (2-3 realistic prompts)
2. Run the skill against test cases
3. Review results with the user
4. Improve based on feedback
5. Keep the prompt lean — remove things not pulling their weight
6. Generalize from feedback — don't overfit to examples
7. Look for repeated work across test cases — bundle helper scripts

## Description Optimization

After creating a skill, optimize the description for better triggering accuracy:

1. Create 20 eval queries (mix of should-trigger and should-not-trigger)
2. Have the user review and adjust
3. Run optimization loop with the eval set
4. Apply the best description

## Packaging

When the skill is complete, the skill lives in `.opencode/skills/<name>/SKILL.md`.
OpenCode automatically discovers skills placed in this directory.
