import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Drawer } from 'vaul';
import { BookOpen, CaretDown, CaretRight, Check, DownloadSimple, ArrowUpRight, ArrowsOutSimple, ArrowsInSimple, TextAa, X, ChatTeardropText, Minus, Plus, WifiSlash, CircleNotch } from '@phosphor-icons/react';
import { type Note, type Scripture, type Source, validateContent, noteReference, inlineSources } from './content';
import { offlineRequest, prepareOffline, watchUpdates } from './offline';

type Panel = { type: 'note'; id: string } | { type: 'verse'; chapter: number; verse: number } | { type: 'phrase'; chapter: number; verse: number; phrase: string } | { type: 'notes' | 'contents' | 'settings' | 'release' };

function SourceLink({ source }: { source: Source }) {
  return <a className="source-link" href={source.url} target="_blank" rel="noopener noreferrer">
    <span>{source.title}{source.author && <small>{source.author}</small>}{source.attribution && <small>{source.attribution}</small>}{source.location && <small>{source.location}</small>}</span><ArrowUpRight size={18} aria-hidden="true" />
  </a>;
}

function noteText(text: string) {
  return inlineSources(text).map((part, index) => part.url ?
    <a key={index} href={part.url} target="_blank" rel="noopener noreferrer">{part.text}</a> :
    part.text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((word, i) => {
      const key = `${index}-${i}`;
      if (word.startsWith('**') && word.endsWith('**') && word.length > 4) return <strong key={key}>{word.slice(2, -2)}</strong>;
      if (word.startsWith('*') && word.endsWith('*') && word.length > 2) return <em key={key}>{word.slice(1, -1)}</em>;
      return word;
    }));
}

function NoteParagraph({ text }: { text: string }) {
  if (text.startsWith('| ')) {
    const [header, , ...rows] = text.split('\n').map(line => line.trim().slice(1, -1).split('|').map(cell => cell.trim()));
    return <div className="note-table"><table><thead><tr>{header.map((cell, i) => <th scope="col" key={i}>{noteText(cell)}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{noteText(cell)}</td>)}</tr>)}</tbody></table></div>;
  }
  return <p>{noteText(text.replace(/^### /, ''))}</p>;
}

function NoteBody({ note }: { note: Note }) {
  return <>
    <div className="note-meta"><span>{note.kind}</span></div>
    <p className="note-summary">{noteText(note.summary)}</p>
    {note.sections.map((section, i) => <details className="disclosure" key={i}>
      <summary>{section.title}<CaretDown size={18} aria-hidden="true" /></summary>
      <div className="disclosure-body">{section.paragraphs.map((paragraph, index) => <NoteParagraph key={index} text={paragraph} />)}</div>
    </details>)}
    <details className="disclosure"><summary>Источники<CaretDown size={18} aria-hidden="true" /></summary><div className="disclosure-body">{note.sources.map(source => <SourceLink key={source.url} source={source} />)}<p className="secondary">Внешние страницы открываются с интернетом.</p></div></details>
  </>;
}

export function App() {
  const [content, setContent] = useState<{ scripture: Scripture; notes: Note[] }>();
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [panel, setPanel] = useState<Panel>({ type: 'contents' });
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<number | string | null>(0.68);
  const [chapter, setChapter] = useState(1);
  const [fontSize, setFontSize] = useState(21);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const focusTarget = useRef<HTMLElement | null>(null);
  const pendingJump = useRef<string | null>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const readingDock = useRef<HTMLElement>(null);
  const dockScrollOrigin = useRef(0);
  const dockScrollPaused = useRef(false);
  const currentFontSize = useRef(fontSize);
  currentFontSize.current = fontSize;
  const resume = useRef<{ id: string; offset: number; fontSize: number } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<(Event & { prompt(): Promise<void> }) | null>(null);

  useEffect(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem('bible-reading-update') ?? 'null');
      if (value && typeof value.id === 'string' && Number.isFinite(value.offset) && Number.isInteger(value.fontSize) && value.fontSize >= 18 && value.fontSize <= 30) {
        resume.current = value; setFontSize(value.fontSize);
      }
    } catch { /* Reading still works when session storage is unavailable. */ }
    return watchUpdates(setUpdateWorker, () => {
      const top = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 100;
      const verse = [...document.querySelectorAll<HTMLElement>('.verse')].find(el => el.getBoundingClientRect().bottom > top);
      if (verse) try {
        sessionStorage.setItem('bible-reading-update', JSON.stringify({ id: verse.id, offset: verse.getBoundingClientRect().top, fontSize: currentFontSize.current }));
      } catch { /* An update must not be blocked by disabled session storage. */ }
    });
  }, []);

  useEffect(() => {
    if (!content || !resume.current) return;
    let cancelled = false;
    document.fonts.ready.then(() => requestAnimationFrame(() => {
      if (cancelled || !resume.current) return;
      const { id, offset } = resume.current;
      const target = document.getElementById(id);
      if (target) window.scrollBy(0, target.getBoundingClientRect().top - offset);
      resume.current = null;
      try { sessionStorage.removeItem('bible-reading-update'); } catch { /* Storage may be unavailable. */ }
    }));
    return () => { cancelled = true; };
  }, [content]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(false);
    Promise.all(['genesis', 'notes'].map(async file => {
      const response = await fetch(`./content/${file}.json`, { signal: controller.signal });
      if (!response.ok) throw new Error('Не удалось загрузить выпуск');
      return response.json();
    })).then(([scripture, notes]) => { validateContent(scripture, notes); setContent({ scripture, notes }); })
      .catch(error => { if (error.name !== 'AbortError') setLoadError(true); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    prepareOffline().then(() => offlineRequest('STATUS')).then(setSaved).catch(() => {});
    const update = () => {
      setOnline(navigator.onLine);
      offlineRequest('STATUS').then(setSaved).catch(() => setSaved(false));
    };
    const captureInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as typeof installPrompt); };
    const installed = () => setInstallPrompt(null);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    window.addEventListener('beforeinstallprompt', captureInstall); window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('online', update); window.removeEventListener('offline', update);
      window.removeEventListener('beforeinstallprompt', captureInstall); window.removeEventListener('appinstalled', installed);
    };
  }, []);

  useEffect(() => {
    if (!content) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setChapter(Number((entry.target as HTMLElement).dataset.chapter));
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('[data-chapter]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [content]);

  useEffect(() => {
    const dock = readingDock.current;
    const scroller = document.scrollingElement;
    if (!content || !dock || !scroller) return;

    const resetOrigin = () => { dockScrollOrigin.current = window.scrollY; };
    resetOrigin();
    const followReading = () => {
      if (dockScrollPaused.current) return;
      const y = Math.max(0, Math.min(window.scrollY, scroller.scrollHeight - scroller.clientHeight));
      const hidden = dock.hasAttribute('data-hidden');
      // Measure from the last turning point so small scroll events can add up.
      const origin = hidden ? Math.max(dockScrollOrigin.current, y) : Math.min(dockScrollOrigin.current, y);
      const next = y > 16 && (hidden ? origin - y < 12 : y - origin >= 32);
      dockScrollOrigin.current = next === hidden ? origin : y;
      if (next !== hidden) dock.toggleAttribute('data-hidden', next);
    };
    window.addEventListener('scroll', followReading, { passive: true });
    window.addEventListener('resize', resetOrigin);
    return () => {
      window.removeEventListener('scroll', followReading);
      window.removeEventListener('resize', resetOrigin);
    };
  }, [content]);

  const { notesByVerse, notesByChapter } = useMemo(() => {
    const notesByVerse = new Map<string, Note[]>();
    const notesByChapter = new Map<number, Note[]>();
    for (const note of content?.notes ?? []) {
      const chapters = new Set<number>();
      for (const key of note.verses) {
        if (!notesByVerse.has(key)) notesByVerse.set(key, []);
        notesByVerse.get(key)!.push(note);
        chapters.add(Number(key.split(':')[0]));
      }
      for (const number of chapters) {
        if (!notesByChapter.has(number)) notesByChapter.set(number, []);
        notesByChapter.get(number)!.push(note);
      }
    }
    return { notesByVerse, notesByChapter };
  }, [content]);
  const notes = content?.notes ?? [];
  const chapterNotes = notesByChapter.get(chapter) ?? [];
  const verseCount = content?.scripture.chapters.reduce((total, c) => total + c.verses.length, 0);
  function showPanel(next: Panel) {
    focusTarget.current = document.activeElement as HTMLElement;
    dockScrollPaused.current = true;
    setPanel(next); setSnap(0.68); setOpen(true); setSaveError('');
    scrollArea.current?.scrollTo(0, 0);
  }
  function showNote(id: string) { setPanel({ type: 'note', id }); scrollArea.current?.scrollTo(0, 0); }
  function jump(id: string) { pendingJump.current = id; setOpen(false); }
  async function download() {
    setSaving(true); setSaveError('');
    try { setSaved(await offlineRequest('DOWNLOAD')); }
    catch (error) { setSaved(false); setSaveError(error instanceof Error ? error.message : 'Не удалось сохранить выпуск. Освободите место и повторите.'); }
    finally { setSaving(false); }
  }

  function annotatedText(text: string, verse: number, chapterNumber: number): ReactNode[] {
    const key = `${chapterNumber}:${verse}`;
    const relatedNotes = (notesByVerse.get(key) ?? []).filter(note => note.anchor?.verse === key);
    const anchors = [...new Map(relatedNotes.map(note => [note.anchor!.phrase, note])).entries()]
      .map(([phrase, note]) => ({ phrase, note, index: text.indexOf(phrase) })).sort((a, b) => a.index - b.index);
    const result: ReactNode[] = []; let position = 0;
    for (const { note, phrase, index } of anchors) {
      const related = relatedNotes.filter(n => n.anchor?.phrase === phrase);
      result.push(text.slice(position, index));
      result.push(<button key={note.id} className={`phrase ${open && panel.type === 'note' && panel.id === note.id ? 'phrase-active' : ''}`}
        aria-label={`${phrase} — ${related.length > 1 ? `открыть пояснения: ${related.length}` : 'открыть пояснение'}`} aria-haspopup="dialog" onClick={() => {
          if (window.getSelection()?.toString()) return;
          showPanel(related.length > 1 ? { type: 'phrase', chapter: chapterNumber, verse, phrase } : { type: 'note', id: note.id });
        }}>{phrase}</button>);
      position = index + phrase.length;
    }
    result.push(text.slice(position)); return result;
  }

  const selectedNote = panel.type === 'note' ? notes.find(n => n.id === panel.id) : undefined;
  const verseKey = panel.type === 'verse' || panel.type === 'phrase' ? `${panel.chapter}:${panel.verse}` : '';
  const verseNotes = (notesByVerse.get(verseKey) ?? []).filter(note =>
    panel.type !== 'phrase' || (note.anchor?.verse === verseKey && note.anchor.phrase === panel.phrase));
  const selectedVerse = panel.type === 'verse' || panel.type === 'phrase' ? content?.scripture.chapters.find(c => c.number === panel.chapter)?.verses.find(v => v.number === panel.verse) : undefined;
  const titles: Record<string, string> = { contents: 'Содержание', notes: 'Пояснения к чтению', settings: 'Как вам удобно', release: 'Чтение без интернета' };
  const title = selectedNote?.title ?? (panel.type === 'phrase' ? panel.phrase : panel.type === 'verse' ? `Бытие ${panel.chapter}:${panel.verse}` : titles[panel.type]);

  function noteList(items: Note[]) {
    return <div className="note-list">{items.map(n => <button key={n.id} className="note-row" onClick={() => showNote(n.id)}>
      <span><small>{noteReference(n)} · {n.kind}</small><strong>{n.title}</strong></span><CaretRight size={19} aria-hidden="true" />
    </button>)}</div>;
  }

  return <div className="app">
    <a className="skip-link" href="#reading">К тексту</a>
    <header className="topbar">
      <button className="icon-button" aria-label="Открыть содержание" onClick={() => showPanel({ type: 'contents' })}><BookOpen size={24} weight="light" aria-hidden="true" /></button>
      <div className="book-title"><span>Бытие</span><small>Синодальный перевод</small></div>
      <button className={`icon-button ${saved ? 'is-saved' : ''}`} aria-label={saved ? 'Выпуск сохранён. Открыть сведения' : 'Сохранить выпуск без интернета'} onClick={() => showPanel({ type: 'release' })}>
        {saved ? <Check size={23} aria-hidden="true" /> : <DownloadSimple size={23} weight="light" aria-hidden="true" />}
      </button>
    </header>
    {!online && <div className="connection-status" role="status"><WifiSlash size={16} aria-hidden="true" />{saved ? 'Без интернета · выпуск на устройстве' : 'Нет соединения с интернетом'}</div>}
    <main id="reading" className="reading" style={{ '--reading-size': `${fontSize}px` } as CSSProperties}>
      <div className="chapter-opening"><h1>Бытие</h1><p>Синодальный перевод</p><div className="opening-rule" aria-hidden="true" /></div>
      <p className="reading-hint">Нажмите номер стиха или <span>подчёркнутую фразу</span>, чтобы открыть пояснения.</p>
      {!content && !loadError && <p role="status" className="loading">Открываем текст…</p>}
      {loadError && <div role="alert" className="load-error"><h2>Не удалось открыть текст</h2><p>Проверьте соединение. Если выпуск ещё не сохранён, для первого открытия нужен интернет.</p><button className="primary-button" onClick={() => setAttempt(attempt + 1)}>Попробовать ещё раз</button></div>}
      {content?.scripture.chapters.map(c => <section key={c.number} data-chapter={c.number} aria-labelledby={`chapter-${c.number}`}>
        <h2 className="chapter-heading" id={`chapter-${c.number}`} tabIndex={-1}>Глава {c.number}</h2>
        {c.verses.map(v => {
          const count = notesByVerse.get(`${c.number}:${v.number}`)?.length ?? 0;
          return <div className={`verse ${v.number === 1 ? 'first-verse' : ''}`} id={`verse-${c.number}-${v.number}`} key={v.number}>
            <button className={`verse-number ${count ? 'has-notes' : ''}`} aria-label={`Бытие ${c.number}:${v.number} — ${count ? `пояснений: ${count}` : 'пояснения к стиху'}`} aria-haspopup="dialog" onClick={() => showPanel({ type: 'verse', chapter: c.number, verse: v.number })}>{v.number}</button>
            <p>{annotatedText(v.text, v.number, c.number)}</p>
          </div>;
        })}
      </section>)}
      {content && <footer className="reading-end"><BookOpen size={25} weight="light" aria-hidden="true" /><p>{content.scripture.reference}</p><span>Вы прочитали книгу</span><button className="text-button" onClick={() => showPanel({ type: 'notes' })}>Вернуться к пояснениям <CaretRight size={16} aria-hidden="true" /></button></footer>}
    </main>
    {updateWorker && <aside className="update-notice" role="status">
      <span>Доступен новый выпуск<small>Место чтения сохранится</small></span>
      <button disabled={updating} onClick={() => {
        try { setUpdating(true); updateWorker.postMessage({ type: 'APPLY_UPDATE' }); }
        catch { setUpdating(false); }
      }}>{updating ? 'Обновляем…' : 'Обновить'}</button>
    </aside>}
    <nav ref={readingDock} className="reading-dock" aria-label="Управление чтением">
      <button className="chapter-control" onClick={() => showPanel({ type: 'contents' })}><BookOpen size={21} weight="light" aria-hidden="true" /><span>Бытие {chapter}</span><CaretDown size={13} aria-hidden="true" /></button>
      <span className="dock-divider" aria-hidden="true" />
      <button className="notes-control" aria-label={`Пояснения к главе ${chapter}: ${chapterNotes.length}`} onClick={() => showPanel({ type: 'notes' })}><ChatTeardropText size={22} weight="light" aria-hidden="true" /><span>{chapterNotes.length}</span></button>
      <button className="icon-button" aria-label="Настройки чтения" onClick={() => showPanel({ type: 'settings' })}><TextAa size={25} weight="light" aria-hidden="true" /></button>
    </nav>

    <Drawer.Root open={open} onOpenChange={setOpen} snapPoints={[0.68, 0.94]} activeSnapPoint={snap} setActiveSnapPoint={setSnap} fadeFromIndex={0} shouldScaleBackground={false} handleOnly>
      <Drawer.Portal><Drawer.Overlay className="sheet-overlay" /><Drawer.Content className="sheet" style={{ '--visible-height': `${Number(snap) * 100}dvh` } as CSSProperties}
        onCloseAutoFocus={event => {
          event.preventDefault();
          const target = pendingJump.current ? document.getElementById(pendingJump.current) : null;
          pendingJump.current = null;
          if (!target) focusTarget.current?.focus({ preventScroll: true });
          requestAnimationFrame(() => {
            if (target) {
              target.scrollIntoView({ block: 'start' });
              readingDock.current?.removeAttribute('data-hidden');
              (target.querySelector<HTMLElement>('button') ?? target).focus({ preventScroll: true });
            }
            dockScrollOrigin.current = window.scrollY;
            dockScrollPaused.current = false;
          });
        }}>
        <Drawer.Handle aria-label="Потяните, чтобы развернуть пояснение" className="sheet-handle" />
        <div className="sheet-toolbar"><span>{selectedNote ? noteReference(selectedNote) : 'Книга Бытие'}</span><div>
          <button className="icon-button" aria-label={snap === 0.94 ? 'Свернуть панель' : 'Развернуть панель'} onClick={() => setSnap(snap === 0.94 ? 0.68 : 0.94)}>{snap === 0.94 ? <ArrowsInSimple size={20} aria-hidden="true" /> : <ArrowsOutSimple size={20} aria-hidden="true" />}</button>
          <Drawer.Close asChild><button className="icon-button close-button" aria-label="Закрыть панель"><X size={20} aria-hidden="true" /></button></Drawer.Close>
        </div></div>
        <div className="sheet-scroll" ref={scrollArea} key={panel.type === 'note' ? panel.id : panel.type}>
          <Drawer.Title className="sheet-title">{title}</Drawer.Title>
          <Drawer.Description className="sr-only">{selectedNote ? 'Редакционное пояснение к библейскому тексту.' : 'Материалы и настройки чтения.'}</Drawer.Description>
          {selectedNote && <NoteBody note={selectedNote} />}
          {(panel.type === 'verse' || panel.type === 'phrase') && <><blockquote className="verse-quote">{selectedVerse?.text}</blockquote>{verseNotes.length ? noteList(verseNotes) : <p className="empty-note">К этому стиху пояснение ещё не подготовлено.</p>}</>}
          {panel.type === 'notes' && <><p className="sheet-intro">Глава {chapter}. Смысл стихов, контекст эпизодов и тематические разборы.</p>{noteList(chapterNotes)}</>}
          {panel.type === 'contents' && <><p className="section-label">Перейти к стиху · глава {chapter}</p><div className="verse-grid">{content?.scripture.chapters.find(c => c.number === chapter)?.verses.map(v => <button key={v.number} onClick={() => jump(`verse-${chapter}-${v.number}`)} aria-label={`Перейти к Бытие ${chapter}:${v.number}`}>{v.number}</button>)}</div>
          <div className="contents-list">{content?.scripture.chapters.map(c => <button key={c.number} className="chapter-row" onClick={() => jump(`chapter-${c.number}`)}><span className="chapter-tile" aria-hidden="true">{c.number}</span><span><strong>Глава {c.number}</strong><small>Стихи 1–{c.verses.length} · пояснений: {notesByChapter.get(c.number)?.length ?? 0}</small></span><CaretRight size={19} aria-hidden="true" /></button>)}</div></>}
          {panel.type === 'settings' && <><p className="sheet-intro">Настройте размер текста для спокойного чтения.</p><div className="type-preview" style={{ fontSize }}>В начале сотворил Бог<br />небо и землю.</div><div className="font-controls"><button className="icon-button" aria-label="Уменьшить текст" disabled={fontSize <= 18} onClick={() => setFontSize(fontSize - 1)}><Minus size={20} aria-hidden="true" /></button><output aria-live="polite">{fontSize} <small>px</small></output><button className="icon-button" aria-label="Увеличить текст" disabled={fontSize >= 30} onClick={() => setFontSize(fontSize + 1)}><Plus size={20} aria-hidden="true" /></button></div><p className="secondary">Масштабирование браузера тоже доступно.</p></>}
          {panel.type === 'release' && <><p className="sheet-intro">Вся книга и пояснения останутся с вами, даже когда нет связи.</p><div className="release-line"><BookOpen size={25} weight="light" aria-hidden="true" /><div><strong>{content?.scripture.reference}</strong><small>Стихов: {verseCount} · пояснений: {notes.length}</small></div></div>
            <button className="primary-button" disabled={saving || saved} onClick={download}>{saving ? <><CircleNotch className="spinner" size={20} aria-hidden="true" />Сохраняем выпуск…</> : saved ? <><Check size={20} aria-hidden="true" />Выпуск на устройстве</> : <><DownloadSimple size={20} aria-hidden="true" />Сохранить выпуск</>}</button>
            <div className="save-status" role="status">{saved && 'Текст и пояснения доступны без интернета. Внешние страницы источников требуют соединения.'}</div>
            {saveError && <p className="save-error" role="alert">{saveError}</p>}
            <details className="disclosure"><summary>Установить на телефон<CaretDown size={18} aria-hidden="true" /></summary><div className="disclosure-body">{installPrompt ? <button className="secondary-button" onClick={async () => { try { await installPrompt.prompt(); setInstallPrompt(null); } catch { setSaveError('Не удалось открыть установку. Используйте меню браузера.'); } }}>Установить приложение</button> : <><p><strong>iPhone:</strong> в Safari откройте меню «Поделиться», затем «На экран “Домой”».</p><p><strong>Android:</strong> в меню браузера выберите «Установить приложение» или «Добавить на главный экран».</p></>}<p className="secondary">Для чтения без сети сначала сохраните выпуск.</p></div></details>
            <details className="disclosure"><summary>О тексте и пояснениях<CaretDown size={18} aria-hidden="true" /></summary><div className="disclosure-body"><p>Синодальный перевод. Текст Писания сохранён в формулировках указанной цифровой редакции.</p>{content?.scripture.sources.map(s => <SourceLink key={s.url} source={s} />)}<p>Пояснения — редакционные разборы, подготовленные с помощью ИИ. Сопоставление — анализ редакции; оно не приписывается одному из упомянутых авторов.</p></div></details>
          </>}
          <div className="sheet-bottom-space" />
        </div>
      </Drawer.Content></Drawer.Portal>
    </Drawer.Root>
  </div>;
}
