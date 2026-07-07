'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input, Spin, Pagination, Card, Tag, Empty, Button, Tabs, Tour } from 'antd';
import { SearchOutlined, ClockCircleOutlined, StarOutlined, StarFilled } from '@ant-design/icons';
import { useT } from '@/lib/i18n';
import { apiGetMyApplicantInfo } from '@/api/applicant-info';
import type { ApplicantInformation } from '@/api/applicant-info';
import { apiGetJobPostList, apiGetJobPostById, apiAddReviewer, apiToggleCollector } from '@/api/job-post';
import { apiGetMyApplications } from '@/api/application';
import type { JobPost } from '@/api/job-post';
import { apiGetDictionaryByKey } from '@/api/dictionary';
import { useAppStore } from '@/lib/store';
import ApplyModal from './apply-modal';

export default function ApplicantView() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useAppStore((s) => s.currentUser);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'posts');
  const [highlightPostId, setHighlightPostId] = useState<number | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingPostId, setPendingPostId] = useState<number | null>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const tabsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [tourOpen, setTourOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<JobPost | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applicantInfo, setApplicantInfo] = useState<ApplicantInformation | null>(null);
  const [appliedPostIds, setAppliedPostIds] = useState<Map<number, string>>(new Map());
  const [countryOptions, setCountryOptions] = useState<{ label: string; value: string }[]>([]);
  const [collectedCount, setCollectedCount] = useState(0);
  const [appliedCount, setAppliedCount] = useState(0);

  const fetchPosts = useCallback(async (p: number, title: string, tab: string) => {
    setLoading(true);
    try {
      const filter = tab === 'collected' ? 'collected' : tab === 'applied' ? 'applied' : undefined;
      const res = await apiGetJobPostList({ page: p, pageSize, title: title || undefined, filter });
      setPosts(res.list);
      setTotal(res.total);
      if (res.list.length > 0 && selectedId == null && !pendingPostId) {
        setSelectedId(res.list[0].id);
      } else if (res.list.length === 0) {
        setSelectedId(null);
      }
    } finally {
      setLoading(false);
    }
  }, [pageSize, selectedId]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
      setSelectedId(null);
      setDetail(null);
      setSearch('');
      setPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    apiGetMyApplicantInfo().then((info) => {
      if (!info) {
        router.replace('/applicant/basicInformation');
      } else {
        setApplicantInfo(info);
        setChecking(false);
      }
    }).catch(() => { setChecking(false); });
    apiGetDictionaryByKey('country').then((dict) => {
      if (dict) setCountryOptions(dict.value.map((v) => ({ label: v, value: v })));
    }).catch(() => {});
    apiGetJobPostList({ filter: 'collected', pageSize: 1 }).then((res) => setCollectedCount(res.total)).catch(() => {});
    const tourKey = 'SmartDepanneur_tour_seen_applicant';
    if (!localStorage.getItem(tourKey)) {
      setTimeout(() => setTourOpen(true), 800);
      localStorage.setItem(tourKey, '1');
    }
  }, [router]);

  useEffect(() => {
    apiGetMyApplications().then((list) => {
      setAppliedPostIds(new Map(list.map((a) => [a.jobPostId, a.state])));
      setAppliedCount(list.length);
      const appIdParam = searchParams.get('appId');
      if (appIdParam) {
        const targetApp = list.find((a) => a.id === Number(appIdParam));
        if (targetApp) {
          // Find which page this post is on within the applied list
          apiGetJobPostList({ filter: 'applied', pageSize: 9999 }).then((res) => {
            const idx = res.list.findIndex((p) => p.id === targetApp.jobPostId);
            if (idx >= 0) {
              const targetPage = Math.floor(idx / pageSize) + 1;
              setPage(targetPage);
            }
            setPendingPostId(targetApp.jobPostId);
          });
        }
      }
    });
  }, [searchParams]);

  useEffect(() => {
    if (!checking) {
      fetchPosts(page, search, activeTab);
    }
  }, [checking, page, search, activeTab]);

  useEffect(() => {
    return () => { if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current); };
  }, []);

  useEffect(() => {
    if (pendingPostId && posts.some((p) => p.id === pendingPostId)) {
      setSelectedId(pendingPostId);
      setHighlightPostId(pendingPostId);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHighlightPostId(null), 5000);
      setTimeout(() => {
        cardRefs.current[pendingPostId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      setPendingPostId(null);
      router.replace('/', { scroll: false });
    }
  }, [posts, pendingPostId]);

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    apiGetJobPostById(selectedId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId, appliedPostIds]);

  if (checking) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}><Spin /></div>;
  }

  const handlePageChange = (p: number) => {
    setPage(p);
    setSelectedId(null);
  };

  const handleApplySuccess = (postId: number) => {
    setAppliedPostIds((prev) => new Map(prev).set(postId, 'applied'));
    setAppliedCount((c) => c + 1);
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setSelectedId(null);
    setDetail(null);
    setSearch('');
    setPage(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div ref={tabsRef} style={{ padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
        <Tabs activeKey={activeTab} onChange={handleTabChange} items={[
          { key: 'posts', label: <span style={{ fontWeight: 700 }}>{t.applicant.tab_job_posts}</span> },
          { key: 'collected', label: <span style={{ fontWeight: 700 }}>{t.applicant.tab_collected} ({collectedCount})</span> },
          { key: 'applied', label: <span style={{ fontWeight: 700 }}>{t.applicant.tab_applied} ({appliedCount})</span> },
        ]} />
      </div>

      {/* Main content: left cards + right detail */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left: post cards */}
        <div style={{ width: 380, borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
          {/* Search */}
          <div ref={searchRef} style={{ padding: '12px 16px' }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t.applicant.search_posts}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); setSelectedId(null); }}
              allowClear
            />
          </div>

          {/* Cards list */}
          <div ref={cardsRef} style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}><Spin /></div>
            ) : posts.length === 0 ? (
              <Empty description={t.applicant.no_posts} style={{ marginTop: 40 }} />
            ) : (
              posts.map((post) => (
                <Card
                  key={post.id}
                  ref={(el: HTMLDivElement | null) => { cardRefs.current[post.id] = el; }}
                  size="small"
                  style={{
                    marginBottom: 8,
                    cursor: 'pointer',
                    borderColor: highlightPostId === post.id ? '#faad14' : selectedId === post.id ? '#1677ff' : undefined,
                    background: highlightPostId === post.id ? '#fffbe6' : selectedId === post.id ? '#e6f4ff' : undefined,
                    boxShadow: highlightPostId === post.id ? '0 0 8px rgba(250,173,20,0.5)' : undefined,
                    transition: 'all 0.3s',
                  }}
                  onClick={() => { setSelectedId(post.id); apiAddReviewer(post.id); }}
                >
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{post.title}</div>
                  <div style={{ color: '#666', fontSize: 13, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {post.jobDescription}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Tag color={post.state === 'active' ? 'green' : 'default'}>{post.state}</Tag>
                      {appliedPostIds.has(post.id)
                        ? <Tag color={appliedPostIds.get(post.id) === 'rejected' ? 'red' : appliedPostIds.get(post.id) === 'reviewed' ? 'green' : 'blue'}>{appliedPostIds.get(post.id)}</Tag>
                        : currentUser && post.reviewer.includes(currentUser.email)
                          ? <Tag color="orange">{t.applicant.reviewer}</Tag>
                          : null}
                    </div>
                    <span style={{ fontSize: 12, color: '#999', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ClockCircleOutlined />
                      {new Date(post.postedAt).toLocaleDateString()}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Pagination */}
          {total > pageSize && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
              <Pagination size="small" current={page} total={total} pageSize={pageSize} onChange={handlePageChange} showSizeChanger={false} />
            </div>
          )}
        </div>

        {/* Right: post detail */}
        <div ref={detailRef} style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {detailLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Spin /></div>
          ) : detail ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{detail.title}</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Button
                    icon={currentUser && detail.collector?.includes(currentUser.id) ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                    onClick={async () => {
                      if (!detail || !currentUser) return;
                      const wasCollected = detail.collector?.includes(currentUser.id);
                      const updated = await apiToggleCollector(detail.id);
                      setDetail(updated);
                      setCollectedCount((c) => wasCollected ? c - 1 : c + 1);
                    }}
                  />
                  {appliedPostIds.has(detail.id) ? (
                    <Button disabled>{appliedPostIds.get(detail.id)}</Button>
                  ) : (
                    <Button type="primary" disabled={detail.state === 'closed'} onClick={() => setApplyOpen(true)}>{t.applicant.apply}</Button>
                  )}
                </div>
              </div>
              <div style={{ marginBottom: 12, fontSize: 13, color: '#888', display: 'flex', gap: 16 }}>
                <span>{t.applicant.posted_by}: <a href={`mailto:${detail.postedBy}`}>{detail.postedBy}</a></span>
                <span>{t.applicant.posted_at}: {new Date(detail.postedAt).toLocaleString()}</span>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: '#333' }}>{detail.jobDescription}</div>
            </div>
          ) : (
            <Empty description={t.applicant.select_post} style={{ marginTop: 80 }} />
          )}
        </div>
      </div>

      <ApplyModal
        open={applyOpen}
        detail={detail}
        applicantInfo={applicantInfo}
        countryOptions={countryOptions}
        onClose={() => setApplyOpen(false)}
        onApplySuccess={handleApplySuccess}
      />
      <Tour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={[
          { title: t.applicant.tab_job_posts, description: t.tour.applicant_tabs, target: () => tabsRef.current! },
          { title: t.applicant.search_posts, description: t.tour.applicant_search, target: () => searchRef.current! },
          { title: t.applicant.tab_job_posts, description: t.tour.applicant_cards, target: () => cardsRef.current! },
          { title: t.applicant.apply, description: t.tour.applicant_detail, target: () => detailRef.current! },
        ]}
      />
    </div>
  );
}
