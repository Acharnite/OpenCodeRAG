import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { ragPlugin } from './dist/plugin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testChatMessage() {
  console.log('🧪 Testing chat.message hook...\n');
  
  const input = {
    directory: __dirname,
  };

  const output = {
    parts: [
      {
        type: 'text',
        text: 'How does the chunking system work? What node types does the TypeScript chunker handle?',
      }
    ]
  };

  try {
    const hooks = await ragPlugin(input);
    
    if (!hooks['chat.message']) {
      console.error('❌ No chat.message hook found');
      process.exit(1);
    }

    console.log('✅ Plugin loaded successfully');
    console.log(`📝 Input query: "${output.parts[0].text}"\n`);
    
    await hooks['chat.message'](input, output);
    
    console.log(`\n📊 Output after plugin processing:\n`);
    console.log(`Total parts: ${output.parts.length}`);
    
    output.parts.forEach((part, i) => {
      if (part.type === 'text') {
        if (part.text.includes('Retrieved Code Context')) {
          console.log(`\n✅ Part ${i}: CODE CONTEXT APPENDED`);
          const lines = part.text.split('\n');
          lines.forEach(line => console.log('  ' + line));
        } else {
          console.log(`\nPart ${i}: Original query`);
          console.log(`  "${part.text}"`);
        }
      }
    });
    
    const contextPart = output.parts.find(p => p.text?.includes('Retrieved Code Context'));
    if (contextPart) {
      const contextLines = contextPart.text.split('\n');
      const fileRefs = contextLines.filter(l => l.includes('.ts') || l.includes('.js'));
      console.log(`\n📂 Retrieved file references: ${fileRefs.length}`);
      fileRefs.forEach(ref => console.log(`  ${ref}`));
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

testChatMessage();
