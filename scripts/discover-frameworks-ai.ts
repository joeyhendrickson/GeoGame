import dotenv from 'dotenv';
import { getEmbedding, chatCompletion } from '../lib/openai';
import { queryPinecone } from '../lib/pinecone';

dotenv.config({ path: '.env.local' });

async function discoverFrameworks() {
  console.log('🔍 Searching Pinecone database for frameworks and matrices using AI analysis...\n');

  // Query for general business/analysis content
  const queryTerms = [
    'framework analysis methodology',
    'business strategy matrix',
    'competitive analysis model',
    'market research framework',
    'strategic planning tool',
  ];

  let allMatches: any[] = [];

  for (const term of queryTerms) {
    try {
      const embedding = await getEmbedding(term);
      const matches = await queryPinecone(embedding, 20);
      allMatches.push(...matches);
    } catch (error) {
      console.warn(`Warning: Failed to search for "${term}":`, error instanceof Error ? error.message : error);
    }
  }

  // Deduplicate by ID
  const uniqueMatches = Array.from(
    new Map(allMatches.map(match => [match.id, match])).values()
  ).slice(0, 50); // Top 50 unique matches

  if (uniqueMatches.length === 0) {
    console.log('⚠️  No content found in Pinecone database. Cannot discover frameworks.');
    return;
  }

  // Build context from matches
  const context = uniqueMatches
    .map((match) => {
      const metadata = match.metadata || {};
      return `[${metadata.title || 'Document'}]: ${(metadata.text || '').substring(0, 500)}`;
    })
    .join('\n\n');

  console.log(`📚 Found ${uniqueMatches.length} relevant documents. Analyzing for frameworks...\n`);

  // Use AI to extract framework names from the content
  const prompt = `Based on the following content from a knowledge base about geolocation games research, identify any business frameworks, analysis matrices, strategic models, or decision-making tools mentioned or applicable to this domain.

Return a JSON array of objects with this structure:
[
  {
    "id": "unique-id-in-kebab-case",
    "name": "Framework Name",
    "description": "Brief description of what this framework analyzes or helps with"
  }
]

Only include frameworks, matrices, or analytical tools that are actually mentioned or clearly relevant to the content. Focus on:
- Business analysis frameworks
- Strategic planning tools
- Market analysis matrices
- Competitive analysis methods
- Decision-making frameworks
- Assessment or evaluation tools

Content to analyze:
${context.substring(0, 15000)} // Limit context size

Return only valid JSON, no markdown formatting.`;

  try {
    const response = await chatCompletion(
      [{ role: 'user', content: prompt }],
      undefined,
      { temperature: 0.3 }
    );

    // Try to extract JSON from response
    let jsonStr = response.trim();
    
    // Remove markdown code blocks if present
    jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to find JSON array in response
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const frameworks = JSON.parse(jsonStr);

    if (Array.isArray(frameworks) && frameworks.length > 0) {
      console.log(`✅ AI identified ${frameworks.length} frameworks/matrices:\n`);
      
      for (const framework of frameworks) {
        console.log(`- ${framework.name}`);
        console.log(`  ${framework.description}\n`);
      }

      console.log('\n📋 Framework list for component:\n');
      console.log('const availableFrameworks: WhitepaperFramework[] = [');
      for (const framework of frameworks) {
        const safeDesc = (framework.description || '').replace(/'/g, "\\'");
        console.log(`  { id: '${framework.id || framework.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}', name: '${framework.name}', description: '${safeDesc}' },`);
      }
      console.log('];\n');

      return frameworks;
    } else {
      console.log('⚠️  No frameworks extracted from content.');
    }
  } catch (error) {
    console.error('❌ Error analyzing content:', error);
    console.log('\n⚠️  Could not extract frameworks. You may need to manually review your database content.');
  }
}

discoverFrameworks().catch(console.error);
