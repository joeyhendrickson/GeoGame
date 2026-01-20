'use client';

import { useState } from 'react';
import { saveFileToDownloads } from './DownloadsMenu';

type WritingStyle = 'easy-read' | 'professional' | 'executive';

interface WhitepaperFramework {
  id: string;
  name: string;
  description: string;
}

const availableFrameworks: WhitepaperFramework[] = [
  // Standard Business Frameworks
  { id: 'swot', name: 'SWOT Analysis', description: 'Strengths, Weaknesses, Opportunities, Threats' },
  { id: 'pestel', name: 'PESTEL Analysis', description: 'Political, Economic, Social, Technological, Environmental, Legal' },
  { id: 'porter', name: "Porter's Five Forces", description: 'Industry competition analysis framework' },
  { id: 'value-chain', name: 'Value Chain Analysis', description: 'Primary and support activities analysis' },
  { id: 'business-model-canvas', name: 'Business Model Canvas', description: 'Nine building blocks of business model' },
  { id: 'competitive-analysis', name: 'Competitive Analysis Matrix', description: 'Competitive landscape and positioning' },
  { id: 'stakeholder-map', name: 'Stakeholder Mapping', description: 'Key stakeholders and their interests' },
  { id: 'risk-assessment', name: 'Risk Assessment Matrix', description: 'Risk identification and mitigation strategies' },
  { id: 'market-segmentation', name: 'Market Segmentation', description: 'Target market analysis and segmentation' },
  { id: 'technology-roadmap', name: 'Technology Roadmap', description: 'Technology adoption and evolution timeline' },
  // Geolocation Games Research-Specific Frameworks (from Pinecone database)
  { id: 'geogame-design-review-matrix', name: 'GeoGame Design Review Matrix', description: 'A structured evaluation matrix used as an early-warning system to review a geolocation game design and surface likely failure risks before building.' },
  { id: 'failure-taxonomy', name: 'Game Failure Taxonomy (Geolocation)', description: 'A taxonomy for categorizing and analyzing recurring failure modes in geolocation games (e.g., platform trend dependency, overly abstract design, unclear value proposition) to guide risk mitigation and design choices.' },
  { id: 'standard-case-study-template', name: 'Standard Case Study Template', description: 'A repeatable case-study analysis template for documenting failed/discontinued games in an analysis-ready format so insights can be compared and expanded into papers, slides, or posts.' },
  { id: 'comparative-analysis-failures-vs-successes', name: 'Comparative Analysis (Failures vs. Pokémon GO vs. Geocaching)', description: 'A comparative analysis method that contrasts a failure set against successful exemplars to isolate non-obvious success factors beyond surface features and checklists.' },
  { id: 'success-framework-stress-test', name: 'Success Framework Stress Test', description: 'A stress-testing tool used to evaluate a concept against a defined success framework to check strategic soundness and identify weak points early.' },
  { id: 'do-not-build-checklist', name: 'Do Not Build Checklist', description: 'A decision-making checklist that flags common anti-patterns and high-risk assumptions (e.g., cultural mismatch, competition replacing continuity) to prevent building ideas likely to fail.' },
  { id: 'total-addressable-market-tam', name: 'Total Addressable Market (TAM) Estimate', description: 'A market-sizing tool (noted as conservative) used to estimate the maximum potential market for a geolocation game concept to inform opportunity assessment and planning.' },
  { id: 'platform-dependency-risk-assessment', name: 'Platform Trend Dependency Risk Assessment', description: 'A risk analysis lens focused on how reliance on external platforms or shifting platform strategies (e.g., Facebook strategy shifts) can create systemic business and product risk.' },
  { id: 'core-loop-analysis', name: 'Core Loop Analysis (Underexplored Core Loops)', description: 'A design/strategy analysis approach that defines player core loops at the mechanics level and evaluates how they avoid historical failure modes while remaining unexhausted in the market.' },
];

export default function WhitepaperGenerator() {
  const [prompt, setPrompt] = useState<string>('');
  const [outputFormat, setOutputFormat] = useState<'pdf' | 'docx' | 'ppt'>('pdf');
  const [numPages, setNumPages] = useState<number>(10);
  const [imagesPerPages, setImagesPerPages] = useState<string>('1');
  const [pagesForImages, setPagesForImages] = useState<string>('3');
  const [writingStyle, setWritingStyle] = useState<WritingStyle>('professional');
  const [selectedFrameworks, setSelectedFrameworks] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{
    stage: string;
    percentage: number;
  } | null>(null);
  const [generatedWhitepaper, setGeneratedWhitepaper] = useState<string | null>(null);
  const [downloadableDocument, setDownloadableDocument] = useState<{
    document: string;
    filename: string;
    mimeType: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleFramework = (frameworkId: string) => {
    setSelectedFrameworks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(frameworkId)) {
        newSet.delete(frameworkId);
      } else {
        newSet.add(frameworkId);
      }
      return newSet;
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt for the whitepaper');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedWhitepaper(null);
    setDownloadableDocument(null);
    setGenerationProgress({ stage: 'Initializing...', percentage: 0 });

    try {
      const imageFrequency = `${imagesPerPages} image per ${pagesForImages} ${outputFormat === 'ppt' ? 'slides' : 'pages'}`;
      const frameworks = Array.from(selectedFrameworks);

      // Simulate progress updates (since the API call is atomic, we show stages)
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          if (!prev) return prev;
          const stages = [
            { stage: 'Querying vector database...', percentage: 10 },
            { stage: 'Retrieving framework context...', percentage: 25 },
            { stage: 'Generating whitepaper content...', percentage: 50 },
            { stage: 'Generating images...', percentage: 75 },
            { stage: 'Creating document...', percentage: 90 },
          ];
          
          // Find current stage based on percentage
          let currentStage = stages[stages.length - 1];
          for (let i = stages.length - 1; i >= 0; i--) {
            if (prev.percentage < stages[i].percentage) {
              currentStage = stages[i];
            }
          }
          
          // Increment percentage slowly
          const nextPercentage = Math.min(prev.percentage + 5, 95);
          return { stage: currentStage.stage, percentage: nextPercentage };
        });
      }, 800);

      const response = await fetch('/api/whitepaper/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          outputFormat,
          numPages: Math.min(numPages, 50),
          imageFrequency,
          writingStyle,
          frameworks,
        }),
      }).catch((fetchError) => {
        console.error('Fetch error:', fetchError);
        throw new Error(`Network error: ${fetchError.message}. Please ensure the server is running and the route is accessible.`);
      });

      // Update to final stage
      clearInterval(progressInterval);
      setGenerationProgress({ stage: 'Finalizing...', percentage: 98 });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        const text = await response.text();
        throw new Error(`Server returned invalid JSON. Status: ${response.status}. Response: ${text.substring(0, 200)}`);
      }

      if (response.ok) {
        // If we got a downloadable document (PDF, DOCX, PPT)
        if (data.document && data.filename && data.mimeType) {
          const doc = {
            document: data.document,
            filename: data.filename,
            mimeType: data.mimeType,
          };
          setDownloadableDocument(doc);
          setGeneratedWhitepaper(null); // Clear text preview
          
          // Save to downloads menu
          const format = outputFormat === 'ppt' ? 'ppt' : outputFormat;
          const fileSize = Math.round((doc.document.length * 3) / 4); // Approximate base64 size
          saveFileToDownloads({
            filename: doc.filename,
            mimeType: doc.mimeType,
            document: doc.document,
            format: format as 'pdf' | 'docx' | 'ppt' | 'txt',
            size: fileSize,
          });
          
          // Dispatch custom event to update downloads menu
          window.dispatchEvent(new Event('fileDownloaded'));
          
          // Auto-download the file after a brief delay
          setTimeout(() => {
            const byteCharacters = atob(doc.document);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: doc.mimeType });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 500);
        } else {
          // Fallback to text preview
          setGeneratedWhitepaper(data.content || data.whitepaper);
          setDownloadableDocument(null);
        }
        setGenerationProgress({ stage: 'Complete!', percentage: 100 });
      } else {
        const errorMsg = data.error || data.message || 'Failed to generate whitepaper';
        const errorDetails = data.details ? `\n\nDetails: ${data.details}` : '';
        const errorHint = data.hint ? `\n\nHint: ${data.hint}` : '';
        throw new Error(`${errorMsg}${errorDetails}${errorHint}`);
      }
    } catch (err) {
      console.error('Whitepaper generation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate whitepaper';
      setError(errorMessage);
      setGenerationProgress(null);
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        // Clear progress after a brief delay to show completion
        setTimeout(() => setGenerationProgress(null), 1000);
      }, 500);
    }
  };

  const handleDownload = () => {
    if (!downloadableDocument) return;

    const byteCharacters = atob(downloadableDocument.document);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: downloadableDocument.mimeType });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadableDocument.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStyleDescription = (style: WritingStyle) => {
    switch (style) {
      case 'easy-read':
        return 'High school level, conversational, laymen\'s terms - makes technical and business concepts accessible to everyone';
      case 'professional':
        return 'Researcher perspective with expert terminology - uses specialist and expert terms when explaining technical or business concepts';
      case 'executive':
        return 'Consolidated point-by-point format with payoff conclusions - demonstrates business value for investors and decision-makers';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-black to-black rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Whitepaper Generator
          </h2>
        </div>
        <p className="text-gray-600 text-lg leading-relaxed">
          Generate comprehensive whitepapers on geolocation games research. The AI will pull relevant information 
          from your knowledge base and organize it according to your selected frameworks and writing style.
        </p>
      </div>

      {/* Main Form */}
      <div className="space-y-6">
        {/* Prompt */}
        <div className="bg-gradient-to-br from-black to-black border-2 border-black rounded-2xl p-6">
          <label className="block text-sm font-semibold text-white mb-3">
            Whitepaper Topic / Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the topic or research area for your whitepaper. For example: 'Analyze the market opportunities for location-based AR gaming'..."
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white resize-none"
            rows={4}
          />
        </div>

        {/* Output Format */}
        <div className="bg-white border-2 border-gray-300 rounded-2xl p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-4">
            Output Format
          </label>
          <div className="grid md:grid-cols-3 gap-3">
            {(['pdf', 'docx', 'ppt'] as const).map((format) => (
              <label
                key={format}
                className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  outputFormat === format
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="outputFormat"
                  value={format}
                  checked={outputFormat === format}
                  onChange={(e) => setOutputFormat(e.target.value as 'pdf' | 'docx' | 'ppt')}
                  className="w-5 h-5 text-black focus:ring-black"
                />
                <div className="font-semibold text-gray-800 uppercase">
                  {format}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Parameters Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Number of Pages/Slides */}
          <div className="bg-white border-2 border-gray-300 rounded-2xl p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Number of {outputFormat === 'ppt' ? 'Slides' : 'Pages'} (max 50)
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={numPages}
              onChange={(e) => setNumPages(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all duration-200"
            />
          </div>

          {/* Images per Page */}
          <div className="bg-white border-2 border-gray-300 rounded-2xl p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Images per Page
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={imagesPerPages}
                onChange={(e) => setImagesPerPages(e.target.value)}
                className="w-20 px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all duration-200"
              />
              <span className="text-gray-600">image(s) per</span>
              <input
                type="number"
                min="1"
                value={pagesForImages}
                onChange={(e) => setPagesForImages(e.target.value)}
                className="w-20 px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all duration-200"
              />
              <span className="text-gray-600">{outputFormat === 'ppt' ? 'slide(s)' : 'page(s)'}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Example: 1 image per 3 pages means 1 image every 3 pages
            </p>
          </div>
        </div>

        {/* Writing Style */}
        <div className="bg-white border-2 border-gray-300 rounded-2xl p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-4">
            Writing Style
          </label>
          <div className="space-y-3">
            {(['easy-read', 'professional', 'executive'] as WritingStyle[]).map((style) => (
              <label
                key={style}
                className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  writingStyle === style
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="writingStyle"
                  value={style}
                  checked={writingStyle === style}
                  onChange={(e) => setWritingStyle(e.target.value as WritingStyle)}
                  className="mt-1 w-5 h-5 text-black focus:ring-black"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-800 capitalize">
                    {style === 'easy-read' ? 'Easy Read' : style === 'professional' ? 'Professional' : 'Executive'}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {getStyleDescription(style)}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Frameworks */}
        <div className="bg-white border-2 border-gray-300 rounded-2xl p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-4">
            Whitepaper Frameworks & Matrices
            <span className="text-gray-500 font-normal ml-2">(Select to include in your whitepaper)</span>
          </label>
          <div className="grid md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {availableFrameworks.map((framework) => (
              <label
                key={framework.id}
                className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedFrameworks.has(framework.id)
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedFrameworks.has(framework.id)}
                  onChange={() => toggleFramework(framework.id)}
                  className="mt-1 w-4 h-4 text-black focus:ring-black border-gray-300 rounded"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-800 text-sm">
                    {framework.name}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {framework.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="px-8 py-4 bg-black text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200"
          >
            {isGenerating ? 'Generating Whitepaper...' : 'Generate Whitepaper'}
          </button>

          {/* Progress Indicator */}
          {generationProgress && (
            <div className="w-full max-w-2xl bg-white border-2 border-gray-300 rounded-2xl p-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">
                  {generationProgress.stage}
                </span>
                <span className="text-sm font-semibold text-gray-600">
                  {generationProgress.percentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-black to-gray-700 transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${generationProgress.percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
            <p className="text-red-800 font-semibold">Error: {error}</p>
          </div>
        )}

        {/* Generated Whitepaper - Text Preview or Download */}
        {downloadableDocument && (
          <div className="bg-white border-2 border-black rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  Generated Whitepaper ({outputFormat.toUpperCase()})
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  File: {downloadableDocument.filename}
                </p>
              </div>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
              >
                Download {outputFormat.toUpperCase()}
              </button>
            </div>
            <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-gray-700 font-medium mb-1">
                    Your whitepaper has been generated successfully!
                  </p>
                  <p className="text-sm text-gray-600">
                    The file has been automatically downloaded to your <strong>Downloads folder</strong> and saved to your <strong>Downloads menu</strong> (top right corner). 
                    You can click the download button above or access it from the hamburger menu to download it again.
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Default location: <code className="bg-gray-200 px-1 rounded">~/Downloads/{downloadableDocument.filename}</code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {generatedWhitepaper && !downloadableDocument && (
          <div className="bg-white border-2 border-black rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Generated Whitepaper (Text Preview)</h3>
              <button
                onClick={() => {
                  const blob = new Blob([generatedWhitepaper], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `whitepaper-${Date.now()}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
              >
                Download TXT
              </button>
            </div>
            <div className="prose max-w-none border-2 border-gray-200 rounded-xl p-6 max-h-[600px] overflow-y-auto">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">
                {generatedWhitepaper}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
