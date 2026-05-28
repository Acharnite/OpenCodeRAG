import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { xmlChunker } from "../../chunker/xml.js";

describe("XmlChunker (csproj)", () => {
  it("language is 'xml'", () => {
    assert.equal(xmlChunker.language, "xml");
  });

  it("fileExtensions includes .xml and .csproj", () => {
    assert.ok(xmlChunker.fileExtensions.includes(".xml"));
    assert.ok(xmlChunker.fileExtensions.includes(".csproj"));
  });

  it("grammarName is 'xml'", () => {
    assert.equal(xmlChunker.grammarName, "xml");
  });

  it("nodeTypes contains element", () => {
    assert.ok(xmlChunker.nodeTypes.has("element"));
  });

  it("chunk returns empty array for empty content", async () => {
    const chunks = await xmlChunker.chunk("test.csproj", "");
    assert.deepStrictEqual(chunks, []);
  });

  it("chunk parses the root element of a csproj file", async () => {
    const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  </ItemGroup>
</Project>`;
    const chunks = await xmlChunker.chunk("test.csproj", csproj);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.content.includes("Project"));
    assert.ok(chunks[0]!.content.includes("PropertyGroup"));
    assert.ok(chunks[0]!.content.includes("ItemGroup"));
  });

  it("chunk generates unique IDs", async () => {
    const csproj = `<Project><PropertyGroup><A>1</A></PropertyGroup></Project>`;
    const chunks = await xmlChunker.chunk("test.csproj", csproj);
    const ids = chunks.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("chunk sets correct startLine metadata", async () => {
    const csproj = `\n<Project Sdk="X"><PropertyGroup><A>1</A></PropertyGroup></Project>`;
    const chunks = await xmlChunker.chunk("test.csproj", csproj);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]!.metadata.startLine, 2);
  });
});
