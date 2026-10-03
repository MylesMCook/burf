'use client';

import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogListItem,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search';
import { SearchDialogOverlay } from 'fumadocs-ui/components/dialog/search';
import { useDocsSearch } from 'fumadocs-core/search/client';
import { fetchClient } from 'fumadocs-core/search/client/fetch';
import type { SortedResult } from 'fumadocs-core/search';
import { FileText } from 'lucide-react';
import { useMemo } from 'react';
import { Scene } from './art/scenes';

// Where people usually want to go, shown before they type.
const suggestions = [
  ['Install', '/getting-started/install', 'Getting started'],
  ['Add a box', '/getting-started/add-a-box', 'Getting started'],
  ['Orchestration', '/guides/orchestration', 'Guides'],
  ['Automations and flows', '/guides/automations', 'Guides'],
  ['Config reference', '/reference/config', 'Reference'],
  ['berth CLI', '/reference/cli', 'Reference'],
] as const;

// A page shows at most this many matching passages, so one long page can't
// fill the list.
const PASSAGES_PER_PAGE = 2;

// Nothing found: the lighthouse, still looking.
function Empty() {
  return (
    <div className="berth-search-empty" role="status">
      <Scene name="lighthouse" width={168} />
      <p>Nothing matches that. Try a command, a file name or an event.</p>
    </div>
  );
}

type Item = SortedResult & { section?: string; suggested?: boolean };

function trim(results: SortedResult[]): Item[] {
  const out: Item[] = [];
  const passages = new Map<string, number>();
  for (const r of results) {
    if (r.type === 'text') {
      const page = r.url.split('#')[0];
      const n = passages.get(page) ?? 0;
      if (n >= PASSAGES_PER_PAGE) continue;
      passages.set(page, n + 1);
    }
    out.push(r);
  }
  return out;
}

function ResultItem({ item, onClick }: { item: Item; onClick: () => void }) {
  // The index's breadcrumbs start at the site's own name; only the section
  // says anything.
  const section = item.section ?? item.breadcrumbs?.filter((b) => b !== 'Berth').at(-1);
  if (item.type === 'page') {
    return (
      <SearchDialogListItem item={item} onClick={onClick} className="berth-search-item" data-kind="page">
        <FileText className="berth-search-icon" aria-hidden="true" />
        <span className="berth-search-title">{item.content}</span>
        {section && <span className="berth-search-section">{section}</span>}
      </SearchDialogListItem>
    );
  }
  return <SearchDialogListItem item={item} onClick={onClick} className="berth-search-item" data-kind={item.type} />;
}

export default function BerthSearchDialog(props: SharedProps) {
  const client = useMemo(() => fetchClient({ api: '/api/search' }), []);
  const { search, setSearch, query } = useDocsSearch({ client });
  const defaults = useMemo<Item[]>(
    () =>
      suggestions.map(([content, url, section]) => ({
        type: 'page' as const,
        id: url,
        content,
        url,
        section,
        suggested: true,
      })),
    [],
  );
  const results = query.data !== 'empty' && query.data ? trim(query.data) : null;
  const items = results ?? defaults;

  return (
    <SearchDialog search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent className="berth-search">
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput placeholder="Search the docs" />
          <SearchDialogClose />
        </SearchDialogHeader>
        {!results && <p className="berth-search-label">Suggested</p>}
        <SearchDialogList items={items} Empty={Empty} Item={({ item, onClick }) => <ResultItem item={item as Item} onClick={onClick} />} />
        <SearchDialogFooter className="berth-search-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> to move
          </span>
          <span>
            <kbd>↵</kbd> to open
          </span>
          <span>
            <kbd>esc</kbd> to close
          </span>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  );
}
