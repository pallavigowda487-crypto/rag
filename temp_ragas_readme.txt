# RAG Assessment Library

<div align="center">

![RAG Assessment](https://img.shields.io/badge/RAG-Assessment-blue) ![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue) ![License](https://img.shields.io/badge/License-MIT-green)

**A lightweight, extensible Node.js library for evaluating Retrieval-Augmented Generation (RAG) systems**

[Documentation](#documentation) ┬╖ [Quick Start](#quick-start) ┬╖ [API Reference](#api-reference) ┬╖ [Examples](#examples) ┬╖ [Contributing](#contributing)

</div>

---

## Overview

**RAG Assessment** is a production-ready evaluation framework for measuring and improving the quality of RAG (Retrieval-Augmented Generation) systems. It provides:

Γ£à **Multiple Evaluation Metrics** - Faithfulness, Relevance, Coherence, Context Precision, Context Recall  
Γ£à **Flexible Dataset Management** - Import/export Q&A pairs from JSON, CSV, or APIs  
Γ£à **Batch Evaluation** - Run evaluations on hundreds of test cases with progress tracking  
Γ£à **LLM Provider Agnostic** - Works with Gemini, Perplexity, OpenAI, Anthropic, and more  
Γ£à **Rich Reporting** - Generate JSON, CSV, and HTML reports with statistical analysis  
Γ£à **CLI Tools** - Command-line interface for evaluation without coding  
Γ£à **Type Safe** - Full TypeScript support with comprehensive interfaces  

Unlike Python-based RAGAS, this library is built for JavaScript/Node.js ecosystems and integrates seamlessly with Express, Next.js, LangChain, and LlamaIndex.

---

## Why RAG Assessment?

RAG systems combine retrieval and generation to answer questions based on domain knowledge. But **how do you know if your RAG is good?**

Without measurement, you can't:
- ≡ƒÜ½ Detect quality degradation after changes
- ≡ƒÜ½ Compare different retrieval strategies
- ≡ƒÜ½ Justify performance to stakeholders
- ≡ƒÜ½ Identify failing edge cases
- ≡ƒÜ½ Track improvements over time

**RAG Assessment solves this** by providing automated quality metrics you can run in CI/CD pipelines, dashboards, and development workflows.

### Quick Comparison

| Feature | RAG Assessment | RAGAS (Python) |
|---------|---|---|
| Language | JavaScript/TypeScript | Python |
| Setup Time | <5 min | ~15 min |
| CLI Support | Γ£à Yes | Γ£à Yes |
| Custom Metrics | Γ£à Easy | Γ£à Complex |
| LLM Providers | 3+ built-in | 1 (OpenAI-focused) |
| Node.js Integration | Γ£à Native | ΓÜá∩╕Å Via subprocess |
| License | MIT | Apache 2.0 |

---

## Installation

### Prerequisites
- **Node.js** 18+ (LTS recommended)
- **npm** 8+ or **yarn**
- API key for at least one LLM provider (Gemini, Perplexity, OpenAI, etc.)

### Quick Install

```bash
npm install @ragas-lib/core
```

### With Specific LLM Provider

```bash
# For Gemini
npm install @ragas-lib/core @ragas-lib/gemini

# For Perplexity
npm install @ragas-lib/core @ragas-lib/perplexity

# For OpenAI
npm install @ragas-lib/core @ragas-lib/openai
```

### From Source (Development)

```bash
git clone https://github.com/yourusername/ragas-lib.git
cd ragas-lib
npm install
npm run build
```

---

## TypeScript Support

This library is **built with TypeScript** and provides **full type definitions** out of the box. No additional `@types/` packages needed.

### TypeScript Configuration

For best experience, configure your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### Type Definitions

All exports include complete type definitions:

```typescript
// TypeScript automatically provides types for all imports
import { 
  RAGAssessment,           // Γ£à Typed
  DatasetManager,          // Γ£à Typed
  BaseMetric,              // Γ£à Typed
  EvaluationResults,       // Γ£à Typed interface
  EvaluationConfig,        // Γ£à Typed interface
  GroundTruthPair,         // Γ£à Typed interface
  LLMProvider,             // Γ£à Typed interface
  EvaluationResult,        // Γ£à Typed interface
} from '@ragas-lib/core';
```

### IDE IntelliSense

Full JSDoc documentation on all types for IDE support:

```typescript
const config: EvaluationConfig = {
  provider: new GeminiProvider(),
  // Γ£à IDE autocomplete shows all available options
  // Γ£à Hover shows documentation and type hints
  // Γ£à Type validation catches errors before runtime
  metrics: ['faithfulness', 'relevance'],
  timeout: 30000,
  retries: 3,
};
```

### Strict Mode

Library is compatible with TypeScript's `strict` mode:

```typescript
// Even in strict mode, full type safety
const evaluator = new RAGAssessment(config);
const results = await evaluator.evaluate({...}); // Γ£à No type errors
```

---

## Quick Start

### 1. Set Up API Credentials

Create a `.env` file in your project root:

```env
# For Gemini (free tier available)
GEMINI_API_KEY=AIzaSy...

# Or Perplexity
PERPLEXITY_API_KEY=pplx-...

# Or OpenAI
OPENAI_API_KEY=sk-...
```

### 2. Create Your First Evaluation (TypeScript)

```typescript
import { RAGAssessment } from '@ragas-lib/core';
import { GeminiProvider } from '@ragas-lib/gemini';

// Initialize the evaluator
const evaluator = new RAGAssessment({
  provider: new GeminiProvider({
    apiKey: process.env.GEMINI_API_KEY,
  }),
  metrics: ['faithfulness', 'relevance', 'coherence'],
});

// Define ground truth Q&A pairs
const dataset = [
  {
    question: 'What are lev-boots?',
    expectedAnswer: 'Lev-boots are gravity-reversing footwear that allow users to levitate and hover.',
  },
  {
    question: 'How do lev-boots work?',
    expectedAnswer: 'They use localized gravity reversal technology to counteract gravitational force on the wearer.',
  },
];

// Run evaluation
const results = await evaluator.evaluate({
  dataset,
  ragAnswers: [
    'Lev-boots enable levitation through advanced physics.',
    'Localized gravity reversal creates upward force.',
  ],
});

console.log(results);
// Output:
// {
//   overall_score: 8.2,
//   metrics: {
//     faithfulness: 8.5,
//     relevance: 8.1,
//     coherence: 8.0
//   },
//   per_question: [
//     { question: '...', scores: { ... }, explanation: '...' },
//     ...
//   ]
// }
```

### 3. Using the CLI

```bash
# Initialize configuration (interactive setup)
npx ragas config

# Evaluate a dataset
npx ragas evaluate --dataset questions.json --output results.json

# Generate reports
npx ragas report --input results.json --format html --output report.html

# Import dataset from CSV
npx ragas import --from questions.csv --format csv
```

### 4. Evaluate Your RAG System

```typescript
import { RAGAssessment, DatasetManager } from '@ragas-lib/core';
import { GeminiProvider } from '@ragas-lib/gemini';

// Step 1: Load or create a dataset
const datasetManager = new DatasetManager();
await datasetManager.loadFromJSON('ground_truth.json');

// Step 2: Initialize evaluator
const evaluator = new RAGAssessment({
  provider: new GeminiProvider(),
  metrics: ['faithfulness', 'relevance', 'coherence'],
});

// Step 3: Get answers from your RAG system
const ragAnswers = [];
for (const pair of datasetManager.getAll()) {
  const ragAnswer = await yourRagSystem.ask(pair.question);
  ragAnswers.push(ragAnswer);
}

// Step 4: Run evaluation
const results = await evaluator.evaluate({
  dataset: datasetManager.getAll(),
  ragAnswers,
  contexts: retrievedContextChunks, // Optional: for context-based metrics
});

// Step 5: Generate reports
const report = await evaluator.generateReport(results, {
  format: 'html',
  includeCharts: true,
  outputPath: './evaluation_report.html',
});

console.log(`Report saved to ${report.path}`);
console.log(`Overall Score: ${results.overall_score}/10`);
```

---

## API Reference

### Core Classes

#### `RAGAssessment`

Main class for running evaluations.

```typescript
const evaluator = new RAGAssessment(config);

// Methods
evaluator.evaluate(options)      // Run evaluation
evaluator.generateReport(results) // Create report
evaluator.registerMetric(metric)  // Add custom metric
```

**Configuration:**
```typescript
interface RAGAssessmentConfig {
  provider: LLMProvider;           // LLM provider instance
  metrics?: string[];              // Metric names to use
  timeout?: number;                // Timeout per question (ms)
  retries?: number;                // Max retries on failure
  parallelConcurrency?: number;    // Parallel evaluation count
  verbose?: boolean;               // Enable logging
}
```

#### `DatasetManager`

Manage ground truth Q&A datasets.

```typescript
const manager = new DatasetManager();

manager.add(pair)                    // Add Q&A pair
manager.remove(id)                   // Delete pair
manager.update(id, pair)             // Update pair
manager.getAll()                     // Get all pairs
manager.loadFromJSON(filePath)       // Import from JSON
manager.saveToJSON(filePath)         // Export to JSON
manager.loadFromCSV(filePath)        // Import from CSV
manager.validate()                   // Validate dataset
```

### Metrics

#### Built-in Metrics

```typescript
// Faithfulness (0-10)
// Measures: How well does the answer align with retrieved context?
// Higher = More faithful to sources

// Relevance (0-10)
// Measures: How well does the answer address the question?
// Higher = More relevant and on-topic

// Coherence (0-10)
// Measures: Is the answer clear, well-structured, and grammatically correct?
// Higher = More coherent

// ContextPrecision (0-1)
// Measures: What % of context chunks are relevant to the answer?
// Higher = Fewer irrelevant chunks retrieved

// ContextRecall (0-1)
// Measures: Did retrieval find enough context to fully answer the question?
// Higher = Complete context retrieved
```

#### Custom Metrics

Create your own evaluation metrics:

```typescript
import { BaseMetric } from '@ragas-lib/core';

class CustomMetric extends BaseMetric {
  name = 'my_metric';
  description = 'My custom RAG metric';
  
  async compute(input: {
    question: string;
    answer: string;
    context: string;
    expectedAnswer?: string;
  }): Promise<{ score: number; explanation: string }> {
    // Your evaluation logic here
    const score = /* calculate score 0-10 */;
    return {
      score,
      explanation: 'Why this score?',
    };
  }
}

// Register and use
evaluator.registerMetric(new CustomMetric());
```

### LLM Providers

#### Gemini Provider

```typescript
import { GeminiProvider } from '@ragas-lib/gemini';

const provider = new GeminiProvider({
  apiKey: process.env.GEMINI_API_KEY,
  model: 'gemini-2.0-flash', // Optional
  temperature: 0.7,           // Optional
  maxTokens: 1024,            // Optional
});
```

#### Perplexity Provider

```typescript
import { PerplexityProvider } from '@ragas-lib/perplexity';

const provider = new PerplexityProvider({
  apiKey: process.env.PERPLEXITY_API_KEY,
  model: 'sonar',
  temperature: 0.5,
});
```

#### OpenAI Provider

```typescript
import { OpenAIProvider } from '@ragas-lib/openai';

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4-turbo',
  temperature: 0.3,
});
```

#### Mock Provider (for Testing)

```typescript
import { MockProvider } from '@ragas-lib/core';

const provider = new MockProvider();
// Returns deterministic scores for testing
```

### Results Format

```typescript
interface EvaluationResults {
  overall_score: number;              // Weighted average (0-10)
  metadata: {
    timestamp: string;
    provider: string;
    model: string;
    metrics_used: string[];
    total_questions: number;
    evaluation_duration_ms: number;
  };
  metrics: {
    [metricName: string]: number;    // Average score per metric
  };
  per_question: Array<{
    question: string;
    answer: string;
    expected_answer?: string;
    scores: { [metricName: string]: number };
    explanations: { [metricName: string]: string };
    overall_score: number;
  }>;
  statistics: {
    mean: number;
    median: number;
    std_dev: number;
    min: number;
    max: number;
    passed_threshold_percentage: number; // % scoring >7
  };
}
```

### Custom Metric Types

When creating custom metrics, use provided interfaces for type safety:

```typescript
import { BaseMetric, MetricInput, MetricOutput } from '@ragas-lib/core';

class MyCustomMetric extends BaseMetric {
  name = 'my_metric';
  description = 'My custom metric';
  
  async compute(input: MetricInput): Promise<MetricOutput> {
    const { question, answer, context, expectedAnswer } = input;
    // Γ£à All properties are typed and required/optional as needed
    
    const score = /* calculate 0-10 */;
    return {
      score,
      explanation: 'Why this score?',
      metadata: { /* optional metadata */ },
    };
  }
}
```

---

## Examples

### Example 1: Evaluate a Simple RAG System

```typescript
// rag-evaluation.ts
import { RAGAssessment } from '@ragas-lib/core';
import { GeminiProvider } from '@ragas-lib/gemini';

async function evaluateRAG() {
  const evaluator = new RAGAssessment({
    provider: new GeminiProvider({
      apiKey: process.env.GEMINI_API_KEY,
    }),
    metrics: ['faithfulness', 'relevance', 'coherence'],
  });

  const testCases = [
    {
      question: 'What is machine learning?',
      expectedAnswer: 'Machine learning is a subset of AI where systems learn from data patterns.',
      ragAnswer: 'ML enables computers to learn from data without explicit programming.',
    },
    {
      question: 'Name three ML algorithms',
      expectedAnswer: 'Decision Trees, Random Forest, Neural Networks',
      ragAnswer: 'Common ML algorithms include Decision Trees, SVM, and K-means clustering.',
    },
  ];

  const results = await evaluator.evaluate({
    dataset: testCases.map(t => ({
      question: t.question,
      expectedAnswer: t.expectedAnswer,
    })),
    ragAnswers: testCases.map(t => t.ragAnswer),
  });

  console.log(`Overall Score: ${results.overall_score}/10`);
  console.log(`\nDetailed Results:`, JSON.stringify(results, null, 2));
}

evaluateRAG().catch(console.error);
```

### Example 2: CI/CD Integration (GitHub Actions)

```yaml
# .github/workflows/rag-evaluation.yml
name: RAG Quality Check

on: [push, pull_request]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      
      - name: Run RAG Evaluation
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: npx ragas evaluate --dataset ground_truth.json --threshold 7.5
      
      - name: Generate Report
        if: always()
        run: npx ragas report --format html --output evaluation_report.html
      
      - name: Upload Report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: evaluation-report
          path: evaluation_report.html
      
      - name: Fail if Score Too Low
        run: |
          SCORE=$(jq '.overall_score' results.json)
          if (( $(echo "$SCORE < 7.5" | bc -l) )); then
            echo "RAG score ($SCORE) below threshold (7.5)"
            exit 1
          fi
```

### Example 3: Express.js Integration

```typescript
// server.ts
import express from 'express';
import { RAGAssessment } from '@ragas-lib/core';
import { GeminiProvider } from '@ragas-lib/gemini';

const app = express();
const evaluator = new RAGAssessment({
  provider: new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY }),
  metrics: ['faithfulness', 'relevance'],
});

app.post('/api/evaluate', async (req, res) => {
  const { dataset, ragAnswers } = req.body;
  
  try {
    const results = await evaluator.evaluate({
      dataset,
      ragAnswers,
    });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

### Example 4: Batch Evaluation with Progress Tracking

```typescript
import { RAGAssessment, DatasetManager } from '@ragas-lib/core';
import { OpenAIProvider } from '@ragas-lib/openai';
import fs from 'fs';

async function batchEvaluation() {
  const datasetManager = new DatasetManager();
  await datasetManager.loadFromJSON('1000_qa_pairs.json');

  const evaluator = new RAGAssessment({
    provider: new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY }),
    parallelConcurrency: 5, // Evaluate 5 at a time
  });

  let processedCount = 0;
  const total = datasetManager.getAll().length;

  const results = await evaluator.evaluate({
    dataset: datasetManager.getAll(),
    ragAnswers: ragAnswersBatch,
    onProgress: (current, total) => {
      console.log(`Progress: ${current}/${total} (${Math.round(current/total*100)}%)`);
    },
  });

  // Save results
  fs.writeFileSync('results.json', JSON.stringify(results, null, 2));
  console.log(`\nEvaluation complete! Results saved to results.json`);
}

batchEvaluation().catch(console.error);
```

---

## Dataset Format

### JSON Format

```json
[
  {
    "id": "q1",
    "question": "What are lev-boots?",
    "expected_answer": "Gravity-reversing footwear...",
    "metadata": {
      "source": "research_paper",
      "difficulty": "easy",
      "tags": ["product", "physics"]
    }
  },
  {
    "id": "q2",
    "question": "How do they work?",
    "expected_answer": "Using localized gravity reversal...",
    "metadata": {
      "source": "white_paper",
      "difficulty": "hard"
    }
  }
]
```

### CSV Format

```csv
question,expected_answer,source,difficulty
"What are lev-boots?","Gravity-reversing footwear...",research_paper,easy
"How do they work?","Using localized gravity reversal...",white_paper,hard
```

### Importing from Different Sources

```typescript
import { DatasetManager } from '@ragas-lib/core';

const manager = new DatasetManager();

// From JSON
await manager.loadFromJSON('questions.json');

// From CSV
await manager.loadFromCSV('questions.csv');

// From API
await manager.loadFromAPI('https://api.example.com/qa-pairs', {
  auth: 'Bearer token',
});

// From Database
await manager.loadFromDatabase(connection, {
  query: 'SELECT question, expected_answer FROM qa_pairs',
});
```

---

## Performance & Optimization

### Parallel Evaluation

```typescript
const evaluator = new RAGAssessment({
  provider: new GeminiProvider(),
  parallelConcurrency: 10, // Process 10 questions simultaneously
  timeout: 30000,          // 30 second timeout per question
});
```

### Rate Limiting & Throttling

```typescript
const evaluator = new RAGAssessment({
  provider: new GeminiProvider(),
  rateLimit: {
    requestsPerMinute: 100,
    burstSize: 20,
  },
});
```

### Cost Estimation

```typescript
import { CostEstimator } from '@ragas-lib/core';

const estimator = new CostEstimator();
const cost = estimator.estimate({
  provider: 'gemini',
  numQuestions: 1000,
  metricsPerQuestion: 3,
});

console.log(`Estimated cost: $${cost.totalCost}`);
console.log(`Input tokens: ${cost.inputTokens}`);
console.log(`Output tokens: ${cost.outputTokens}`);
```

---

## Troubleshooting

### Issue: API Key Not Found

```bash
Error: GEMINI_API_KEY not found in environment variables

Solution:
1. Create .env file with your API key
2. Or set environment variable: export GEMINI_API_KEY=your_key_here
3. Verify with: echo $GEMINI_API_KEY
```

### Issue: Rate Limit Exceeded

```bash
Error: Rate limit exceeded. Max 60 requests per minute.

Solution:
1. Reduce parallelConcurrency (default: 5)
2. Enable rate limiting with requestsPerMinute setting
3. Use retry logic with exponential backoff
```

### Issue: Timeout on Large Datasets

```typescript
// Increase timeout for complex evaluations
const evaluator = new RAGAssessment({
  provider: new GeminiProvider(),
  timeout: 60000, // 60 seconds
  retries: 3,
});
```

### Debug Mode

```typescript
const evaluator = new RAGAssessment({
  provider: new GeminiProvider(),
  verbose: true, // Enable detailed logging
  logger: console, // Use custom logger
});
```

---

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create a branch** (`git checkout -b feature/your-feature`)
3. **Make changes** and write tests
4. **Run tests** (`npm test`)
5. **Submit a PR** with a clear description

### Development Setup

```bash
git clone https://github.com/yourusername/ragas-lib.git
cd ragas-lib
npm install
npm run build
npm test
```

### Areas Welcoming Contributions

- ≡ƒåò New LLM provider adapters (Claude, Cohere, etc.)
- ≡ƒôè Additional evaluation metrics
- ≡ƒôü Dataset format loaders (Excel, Notion, etc.)
- ≡ƒÉ¢ Bug fixes and performance improvements
- ≡ƒô¥ Documentation and examples
- ≡ƒº¬ Test coverage improvements

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## Documentation

- **[Full API Documentation](./docs/API.md)** - Detailed reference for all classes and methods
- **[Architecture Guide](./docs/ARCHITECTURE.md)** - System design and extensibility
- **[Provider Integration Guide](./docs/PROVIDERS.md)** - How to implement custom providers
- **[Metric Development Guide](./docs/METRICS.md)** - Creating custom evaluation metrics
- **[CLI Reference](./docs/CLI.md)** - Command-line tool documentation
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions

---

## Examples Repository

Full working examples available at:
- [ragas-lib-examples](https://github.com/yourusername/ragas-lib-examples)
- Express.js integration
- Next.js dashboard
- LangChain integration
- Docker deployment

---

## Roadmap

### v0.1.0 (Current)
- Γ£à Core metrics (Faithfulness, Relevance, Coherence)
- Γ£à Dataset management
- Γ£à Batch evaluation
- Γ£à JSON/CSV reports
- Γ£à Gemini provider

### v0.2.0 (Q1 2026)
- ≡ƒöä Context Precision & Recall metrics
- ≡ƒöä Perplexity & OpenAI providers
- ≡ƒöä Full CLI interface
- ≡ƒöä HTML report generation

### v0.3.0 (Q2 2026)
- ≡ƒöä Custom metric composition
- ≡ƒöä Database adapters (PostgreSQL, SQLite)
- ≡ƒöä Web dashboard
- ≡ƒöä Webhook integrations

### v1.0.0 (Q3 2026)
- ≡ƒöä Stable API
- ≡ƒöä Production-grade performance
- ≡ƒöä Large-scale benchmark datasets
- ≡ƒöä Enterprise support

---

## License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) file for details.

---

## Support & Community

- ≡ƒÆ¼ **Discussions:** [GitHub Discussions](https://github.com/yourusername/ragas-lib/discussions)
- ≡ƒÉ¢ **Issues:** [Report a bug](https://github.com/yourusername/ragas-lib/issues)
- ≡ƒÆí **Feature Requests:** [Suggest a feature](https://github.com/yourusername/ragas-lib/issues)
- ≡ƒôº **Email:** [hello@ragas-lib.dev](mailto:hello@ragas-lib.dev)

---

## Acknowledgments

This library was built based on:
- **RAGAS** (Python) - Pioneering RAG evaluation framework
- **LevBoots Project** - Real-world RAG implementation patterns
- **LangChain & LlamaIndex** - RAG ecosystem leadership
- **Community feedback** - Invaluable insights and use cases

---

<div align="center">

**Polo and ikrigel Made it with Γ¥ñ∩╕Å for the RAG community**
**Thank you Jona for the challenge Γ¥ñ∩╕Å≡ƒÖÅ**

[Γ¼å Back to top](#rag-assessment-library)

</div>
