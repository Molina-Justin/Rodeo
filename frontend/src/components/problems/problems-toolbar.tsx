import {
  ArrowDownAZIcon,
  ArrowUpAZIcon,
  ArrowUpDownIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  Columns3Icon,
  FlameIcon,
  GaugeIcon,
  HashIcon,
  LayersIcon,
  ListFilterIcon,
  LockIcon,
  PercentIcon,
  SearchIcon,
  SignalIcon,
  SparklesIcon,
  TagIcon,
  TypeIcon,
  UnlockIcon,
  XIcon,
} from "lucide-react"

import { PROBLEM_COLUMNS } from "@/components/problems/problems-columns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import type {
  AccessFilter,
  DifficultyFilter,
  ProblemColumnId,
  ProblemFilters,
  ProblemSort,
  StatusFilter,
} from "@/types"

type Option<T> = {
  value: T
  label: string
  icon: typeof HashIcon
  className?: string
}

const difficultyOptions: Option<DifficultyFilter>[] = [
  { value: "all", label: "Any difficulty", icon: SignalIcon },
  {
    value: "easy",
    label: "Easy",
    icon: GaugeIcon,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  {
    value: "medium",
    label: "Medium",
    icon: GaugeIcon,
    className: "text-amber-600 dark:text-amber-400",
  },
  {
    value: "hard",
    label: "Hard",
    icon: FlameIcon,
    className: "text-destructive",
  },
]

const statusOptions: Option<StatusFilter>[] = [
  { value: "all", label: "Any status", icon: LayersIcon },
  {
    value: "not-started",
    label: "Not started",
    icon: CircleDashedIcon,
    className: "text-muted-foreground",
  },
  {
    value: "solved",
    label: "Solved",
    icon: CircleCheckIcon,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  {
    value: "review",
    label: "Review",
    icon: CircleDotIcon,
    className: "text-amber-600 dark:text-amber-400",
  },
  {
    value: "struggling",
    label: "Struggling",
    icon: CircleAlertIcon,
    className: "text-destructive",
  },
]

const accessOptions: Option<AccessFilter>[] = [
  { value: "all", label: "Free and premium", icon: LayersIcon },
  {
    value: "free",
    label: "Free only",
    icon: UnlockIcon,
    className: "text-sky-600 dark:text-sky-400",
  },
  {
    value: "premium",
    label: "Premium only",
    icon: LockIcon,
    className: "text-amber-600 dark:text-amber-400",
  },
]

const sortOptions: Option<ProblemSort>[] = [
  { value: "id-asc", label: "Number, low to high", icon: HashIcon },
  { value: "id-desc", label: "Number, high to low", icon: HashIcon },
  { value: "title-asc", label: "Title, A to Z", icon: ArrowDownAZIcon },
  { value: "title-desc", label: "Title, Z to A", icon: ArrowUpAZIcon },
  { value: "difficulty-asc", label: "Easiest first", icon: GaugeIcon },
  { value: "difficulty-desc", label: "Hardest first", icon: FlameIcon },
  {
    value: "acceptance-desc",
    label: "Highest acceptance",
    icon: PercentIcon,
  },
  { value: "acceptance-asc", label: "Lowest acceptance", icon: PercentIcon },
]

const columnIcons: Record<ProblemColumnId, typeof HashIcon> = {
  status: CircleDotIcon,
  number: HashIcon,
  problem: TypeIcon,
  topic: TagIcon,
  difficulty: GaugeIcon,
  lastAttempt: SparklesIcon,
  acceptance: PercentIcon,
}

const menuItemClass =
  "gap-2.5 rounded-lg px-2.5 py-2 [&_svg:not([class*='text-'])]:text-muted-foreground"

const triggerClass = "h-10 gap-2 rounded-lg px-3 font-normal"

interface ProblemsToolbarProps {
  filters: ProblemFilters
  sort: ProblemSort
  activeFilterCount: number
  visibleColumns: ProblemColumnId[]
  onFiltersChange: (filters: Partial<ProblemFilters>) => void
  onSortChange: (sort: ProblemSort) => void
  onColumnToggle: (column: ProblemColumnId, visible: boolean) => void
  onReset: () => void
}

function Section<T extends string>({
  label,
  icon: Icon,
  iconClassName,
  options,
  value,
  onChange,
}: {
  label: string
  icon: typeof HashIcon
  iconClassName: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <DropdownMenuRadioGroup
      value={value}
      onValueChange={(next) => onChange(next as T)}
    >
      <DropdownMenuLabel className="mb-1 flex items-center gap-2 px-2.5 text-xs font-medium text-muted-foreground">
        <Icon className={`size-3.5 ${iconClassName}`} />
        {label}
      </DropdownMenuLabel>
      {options.map((option) => (
        <DropdownMenuRadioItem
          key={option.value}
          value={option.value}
          className={menuItemClass}
          closeOnClick={false}
        >
          <option.icon className={option.className} />
          {option.label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  )
}

export function ProblemsToolbar({
  filters,
  sort,
  activeFilterCount,
  visibleColumns,
  onFiltersChange,
  onSortChange,
  onColumnToggle,
  onReset,
}: ProblemsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <InputGroup className="h-10 w-full min-w-56 flex-1 rounded-lg sm:max-w-sm">
        <InputGroupAddon className="pl-3 text-muted-foreground">
          <SearchIcon className="text-sky-600 dark:text-sky-400" />
        </InputGroupAddon>
        <InputGroupInput
          value={filters.search}
          onChange={(event) => onFiltersChange({ search: event.target.value })}
          placeholder="Search by title or number"
          aria-label="Search problems"
        />
      </InputGroup>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" className={triggerClass} />}
        >
          <ListFilterIcon className="text-indigo-600 dark:text-indigo-400" />
          Filter
          {activeFilterCount > 0 ? (
            <Badge className="size-5 justify-center rounded-full p-0 tabular-nums">
              {activeFilterCount}
            </Badge>
          ) : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-56 rounded-xl p-1.5"
        >
          <Section
            label="Difficulty"
            icon={GaugeIcon}
            iconClassName="text-amber-600 dark:text-amber-400"
            options={difficultyOptions}
            value={filters.difficulty}
            onChange={(value) => onFiltersChange({ difficulty: value })}
          />
          <DropdownMenuSeparator className="my-1.5" />
          <Section
            label="Status"
            icon={CircleDotIcon}
            iconClassName="text-emerald-600 dark:text-emerald-400"
            options={statusOptions}
            value={filters.status}
            onChange={(value) => onFiltersChange({ status: value })}
          />
          <DropdownMenuSeparator className="my-1.5" />
          <Section
            label="Access"
            icon={LockIcon}
            iconClassName="text-sky-600 dark:text-sky-400"
            options={accessOptions}
            value={filters.access}
            onChange={(value) => onFiltersChange({ access: value })}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" className={triggerClass} />}
        >
          <ArrowUpDownIcon className="text-emerald-600 dark:text-emerald-400" />
          Sort
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 rounded-xl p-1.5">
          <DropdownMenuRadioGroup
            value={sort}
            onValueChange={(next) => onSortChange(next as ProblemSort)}
          >
            <DropdownMenuLabel className="mb-1 flex items-center gap-2 px-2.5 text-xs font-medium text-muted-foreground">
              <ArrowUpDownIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              Sort by
            </DropdownMenuLabel>
            {sortOptions.map((option) => (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className={menuItemClass}
              >
                <option.icon className={option.className} />
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" className={`${triggerClass} ml-auto`} />
          }
        >
          <Columns3Icon className="text-violet-600 dark:text-violet-400" />
          Columns
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52 rounded-xl p-1.5">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="mb-1 flex items-center gap-2 px-2.5 text-xs font-medium text-muted-foreground">
              <Columns3Icon className="size-3.5 text-violet-600 dark:text-violet-400" />
              Visible columns
            </DropdownMenuLabel>
            {PROBLEM_COLUMNS.map((column) => {
              const checked = visibleColumns.includes(column.id)
              const Icon = columnIcons[column.id]

              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={checked}
                  disabled={checked && visibleColumns.length === 1}
                  onCheckedChange={(value) => onColumnToggle(column.id, value)}
                  closeOnClick={false}
                  className={menuItemClass}
                >
                  <Icon />
                  {column.label}
                </DropdownMenuCheckboxItem>
              )
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {activeFilterCount > 0 ? (
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
