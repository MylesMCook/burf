'use client';

import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search';
import { useDocsSearch } from 'fumadocs-core/search/client';
import { fetchClient } from 'fumadocs-core/search/client/fetch';
import { useMemo } from 'react';
import { Scene } from './art/scenes';

// Where people usually want to go, shown before they type.
const suggestions = [
  ['Install', '/getting-started/install'],
  ['Add a box', '/getting-started/add-a-box'],
  ['Orchestration', '/guides/orchestration'],
  ['Automations and flows', '/guides/automations'],
  ['.berth/config.json', '/reference/config'],
  ['berth CLI', '/reference/cli'],
] as const;

// Nothing found: the lighthouse, still looking.
function Empty() {
  return (
    <div className="berth-search-empty">
      <Scene name="lighthouse" width={168} />
      <p>Nothing matches that yet. Try a command, a file name or an event.</p>
    </div>
  );
}

export default function BerthSearchDialog(props: SharedProps) {
  const client = useMemo(() => fetchClient({ api: '/api/search' }), []);
  const { search, setSearch, query } = useDocsSearch({ client });
  const defaults = useMemo(
    () => suggestions.map(([content, url]) => ({ type: 'page' as const, id: url, content, url })),
    [],
  );

  return (
    <SearchDialog search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data !== 'empty' ? query.data : defaults} Empty={Empty} />
      </SearchDialogContent>
    </SearchDialog>
  );
}
