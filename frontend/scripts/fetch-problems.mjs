import { writeFile, mkdir } from "node:fs/promises"

const ENDPOINT = "https://leetcode.com/graphql"
const PAGE_SIZE = 100
const OUTPUT = "public/data/leetcode-problems.json"

const QUERY = `query problems($filters: QuestionFilterInput, $limit: Int, $skip: Int, $categorySlug: String) {
  problemsetQuestionListV2(filters: $filters, limit: $limit, skip: $skip, categorySlug: $categorySlug) {
    totalLength
    questions {
      questionFrontendId
      title
      titleSlug
      difficulty
      paidOnly
      acRate
      topicTags { name }
    }
  }
}`

async function fetchPage(skip) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        categorySlug: "all-code-essentials",
        limit: PAGE_SIZE,
        skip,
        filters: { filterCombineType: "ALL" },
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status} at skip=${skip}`)
  }

  const payload = await response.json()
  if (payload.errors) {
    throw new Error(JSON.stringify(payload.errors))
  }

  return payload.data.problemsetQuestionListV2
}

const problems = []
let total = Infinity

for (let skip = 0; skip < total; skip += PAGE_SIZE) {
  const page = await fetchPage(skip)
  total = page.totalLength

  for (const question of page.questions) {
    problems.push({
      id: Number(question.questionFrontendId),
      title: question.title,
      slug: question.titleSlug,
      difficulty: question.difficulty.toLowerCase(),
      premium: question.paidOnly,
      acceptance: Math.round(question.acRate * 1000) / 10,
      topics: question.topicTags.map((tag) => tag.name),
    })
  }

  process.stdout.write(`\rfetched ${problems.length}/${total}`)
}

problems.sort((a, b) => a.id - b.id)

await mkdir("public/data", { recursive: true })
await writeFile(OUTPUT, JSON.stringify(problems))
process.stdout.write(`\nwrote ${problems.length} problems to ${OUTPUT}\n`)
