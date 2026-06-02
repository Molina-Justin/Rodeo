import { SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ALL_TOPICS } from "@/lib/problems"
import type {
  AccessFilter,
  DifficultyFilter,
  ProblemFilters,
  ProblemSort,
} from "@/types"

const difficultyLabels: Record<DifficultyFilter, string> = {
  all: "All difficulties",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
}

const accessLabels: Record<AccessFilter, string> = {
  all: "All problems",
  free: "Free only",
  premium: "Premium only",
}

const sortLabels: Record<ProblemSort, string> = {
  "id-asc": "Number",
  "id-desc": "Number, reversed",
  "title-asc": "Title A–Z",
  "title-desc": "Title Z–A",
  "difficulty-asc": "Easiest first",
  "difficulty-desc": "Hardest first",
  "acceptance-desc": "Highest acceptance",
  "acceptance-asc": "Lowest acceptance",
}

interface ProblemsToolbarProps {
  filters: ProblemFilters
  sort: ProblemSort
  topics: string[]
  isFiltered: boolean
  onFiltersChange: (filters: Partial<ProblemFilters>) => void
  onSortChange: (sort: ProblemSort) => void
  onReset: () => void
}

export function ProblemsToolbar({
  filters,
  sort,
  topics,
  isFiltered,
  onFiltersChange,
  onSortChange,
  onReset,
}: ProblemsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <InputGroup className="h-10 w-full min-w-56 flex-1 rounded-lg sm:max-w-sm">
        <InputGroupAddon className="pl-3 text-muted-foreground">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          value={filters.search}
          onChange={(event) => onFiltersChange({ search: event.target.value })}
          placeholder="Search by title or number"
          aria-label="Search problems"
        />
      </InputGroup>

      <Select
        value={filters.difficulty}
        onValueChange={(value) =>
          onFiltersChange({ difficulty: value as DifficultyFilter })
        }
      >
        <SelectTrigger className="h-10 min-w-36 rounded-lg" aria-label="Difficulty">
          <SelectValue>
            {(value: DifficultyFilter) => difficultyLabels[value]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(difficultyLabels) as DifficultyFilter[]).map((value) => (
            <SelectItem key={value} value={value}>
              {difficultyLabels[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.topic}
        onValueChange={(value) => onFiltersChange({ topic: value as string })}
      >
        <SelectTrigger className="h-10 min-w-36 rounded-lg" aria-label="Topic">
          <SelectValue>
            {(value: string) => (value === ALL_TOPICS ? "All topics" : value)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-80">
          <SelectItem value={ALL_TOPICS}>All topics</SelectItem>
          {topics.map((topic) => (
            <SelectItem key={topic} value={topic}>
              {topic}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.access}
        onValueChange={(value) =>
          onFiltersChange({ access: value as AccessFilter })
        }
      >
        <SelectTrigger className="h-10 min-w-32 rounded-lg" aria-label="Access">
          <SelectValue>{(value: AccessFilter) => accessLabels[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(accessLabels) as AccessFilter[]).map((value) => (
            <SelectItem key={value} value={value}>
              {accessLabels[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={sort}
        onValueChange={(value) => onSortChange(value as ProblemSort)}
      >
        <SelectTrigger className="ml-auto h-10 min-w-44 rounded-lg" aria-label="Sort by">
          <SelectValue>
            {(value: ProblemSort) => `Sort: ${sortLabels[value]}`}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(sortLabels) as ProblemSort[]).map((value) => (
            <SelectItem key={value} value={value}>
              {sortLabels[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isFiltered ? (
        <Button
          variant="ghost"
          className="h-10 rounded-lg text-muted-foreground"
          onClick={onReset}
        >
          <XIcon />
          Clear
        </Button>
      ) : null}
    </div>
  )
}
