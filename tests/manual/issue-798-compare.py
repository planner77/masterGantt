from pathlib import Path
import json,hashlib
out=Path('output/playwright/issue-798')
load=lambda p:json.loads(p.read_text())
bm=load(out/'before'/'dashboards-manifest.json');am=load(out/'after'/'dashboards-manifest.json')
assert bm['faults']==am['faults']==[]
assert bm['preservationPassed'] and am['preservationPassed']
assert bm['beforeSnapshot']['fingerprint']==am['afterSnapshot']['fingerprint']
assert bm['collectorHashAtStart']==am['collectorHashAtStart']==am['collectorHashAtEnd']
changed=[p for p,h in bm['sourceHashes'].items() if am['sourceHashes'][p]!=h]
expected=['src/features/resources/wbs-view-composer.tsx','src/features/resources/wbs-view-dashboard.tsx','src/features/resources/wbs-view.module.css']
assert sorted(changed)==expected
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in am['sourceHashes'].items())
rows=[]
for width in [390,768,1024,1440,1920]:
 for root in ['kpi','milestone','process','equipment','system','resource']:
  key=f'{root}-{width}';b=load(out/'before'/f'{key}.json');a=load(out/'after'/f'{key}.json')
  bp=b['metrics']['primary'];ap=a['metrics']['primary']
  if root!='kpi':
   br=b['reports'][-1];ar=a['reports'][-1]
   assert br==ar,(key,'report equality')
  def geometry(p):
   primary=p['metrics']['primary']
   labels=[i for i in p['metrics']['filters'] if i['text'] in ['표의 이름 찾기','작업 검색','조회 시작일','조회 종료일'] or i['text'].startswith(('작업 상태','이름 정렬'))]
   return dict(headerY=primary['root']['y'],firstKpiY=primary['firstSummary']['y'],firstTableY=primary['table']['y'],fullyVisibleValues=primary['fullyVisibleValues'],valueCount=primary['valueCount'],fullyVisibleRows=primary['fullyVisibleRows'],rowCount=primary['rowCount'],visibleFilterLabelRows=len(set(i['y'] for i in labels)),visibleFilterLabels=len(labels),documentOverflow=p['facts']['document']['scrollWidth']-p['facts']['document']['clientWidth'],headerControlToFirstData=primary['firstSummary']['y']-primary['root']['y'])
  bg=geometry(b);ag=geometry(a)
  assert bg['documentOverflow']==ag['documentOverflow']==0,(key,'document overflow')
  assert bg['valueCount']==ag['valueCount'],(key,'value count changed')
  assert bg['rowCount']==ag['rowCount'],(key,'row count changed')
  if root=='kpi':assert bg==ag,(key,'KPI KEEP')
  else:
   assert ag['firstTableY']<bg['firstTableY'],(key,'table Y did not improve')
   assert ag['firstKpiY']<bg['firstKpiY'],(key,'first summary Y did not improve')
  rows.append(dict(key=key,before=bg,after=ag,firstDataReductionPx=round(bg['firstKpiY']-ag['firstKpiY'],5),reportSnapshotTotalsSpecFiltersEqual=True if root!='kpi' else 'N/A KPI separate endpoint'))
receiptBefore=load(out/'before-supplemental-reports.json');receiptAfter=load(out/'after-supplemental-reports.json')
assert receiptBefore['receipts']==receiptAfter['receipts']
comparison=dict(status='PASS',interpretation='Local Chromium observation and unchanged API receipt equality; not remote CI/independent business QA.',beforeSourceSha=bm['sourceSha'],afterCheckoutHeadSha=am['sourceSha'],sourceWorkingTreeModified=True,afterSourceIdentity="afterSourceHashes pin the captured working-tree product bytes; checkout HEAD is baseline only, not the after product source",collectorSha256=am['collectorHashAtStart'],sourceChanges=changed,afterSourceHashes={p:am['sourceHashes'][p] for p in changed},backendSourceUnchanged=True,pairs=len(rows),kpiKeepPairs=sum(row["key"].startswith("kpi-") for row in rows),dynamicViewImprovedPairs=sum(not row["key"].startswith("kpi-") and row["firstDataReductionPx"] > 0 for row in rows),canonicalFingerprint=bm['beforeSnapshot']['fingerprint'],canonicalRevision=am['afterSnapshot']['revision'],taskCount=am['afterSnapshot']['tasks'],assignmentCount=am['afterSnapshot']['assignments'],mutationsBefore=len(bm['afterSnapshot']['writes']),mutationsAfter=len(am['afterSnapshot']['writes']),supplementalRawReportEquality=True,supplementalRawReportsScope='Five default specs, identical original before snapshotId, same fixture canonical fingerprint, taskIds/assignmentIds/fullMilestones/configuration/totals/metadata. Before supplemental read occurred after presentation-only edit with unchanged backend source; original browser before payload did not retain raw IDs/Gates.',geometry=rows)
(out/'comparison.json').write_text(json.dumps(comparison,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in comparison.items() if k not in ['geometry','afterSourceHashes']},ensure_ascii=False))
