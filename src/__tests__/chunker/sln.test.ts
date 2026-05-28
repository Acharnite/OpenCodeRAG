import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { slnChunker } from "../../chunker/sln.js";

describe("SlnChunker", () => {
  it("language is 'sln'", () => {
    assert.equal(slnChunker.language, "sln");
  });

  it("fileExtensions includes .sln", () => {
    assert.ok(slnChunker.fileExtensions.includes(".sln"));
    assert.equal(slnChunker.fileExtensions.length, 1);
  });

  it("chunk returns empty array for empty content", async () => {
    const chunks = await slnChunker.chunk("test.sln", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk parses project sections in a solution file", async () => {
    const sln = `Microsoft Visual Studio Solution File
Project("{FAE04EC0-301F}") = "MyApp", "src\\MyApp\\MyApp.csproj", "{A1B2}"
EndProject
Project("{FAE04EC0-301F}") = "MyLib", "src\\MyLib\\MyLib.csproj", "{C3D4}"
EndProject
Global
\tGlobalSection(SolutionConfigurationPlatforms) = preSolution
\t\tDebug|Any CPU = Debug|Any CPU
\tEndGlobalSection
EndGlobal`;
    const chunks = await slnChunker.chunk("test.sln", sln);
    assert.equal(chunks.length, 3);
    assert.ok(chunks[0]!.content.includes("MyApp"));
    assert.ok(chunks[1]!.content.includes("MyLib"));
    assert.ok(chunks[2]!.content.includes("GlobalSection"));
  });

  it("chunk generates unique IDs", async () => {
    const sln = `Project("A") = "A", "A.csproj", "{A}"\nEndProject\nProject("B") = "B", "B.csproj", "{B}"\nEndProject`;
    const chunks = await slnChunker.chunk("test.sln", sln);
    const ids = chunks.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("chunk sets correct startLine metadata", async () => {
    const sln = `\nProject("A") = "A", "A.csproj", "{A}"\nEndProject`;
    const chunks = await slnChunker.chunk("test.sln", sln);
    assert.equal(chunks[0]!.metadata.startLine, 2);
  });
});
