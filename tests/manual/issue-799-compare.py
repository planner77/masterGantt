"""Compare complete same-fixture #799 observations; table shifts are facts, not a universal target."""
from pathlib import Path
import hashlib
import json

out = Path('output/playwright/issue-799')
load = lambda path: json.loads(path.read_text())
before = load(out/'before/dashboards-manifest.json')
after = load(out/'after/dashboards-manifest.json')
assert before['faults'] == after['faults'] == []
assert before['preservationPassed'] and after['preservationPassed']
assert before['plannedSamples'] == after['plannedSamples'] == 30
assert before['collectorHashAtStart'] == before['collectorHashAtEnd'] == after['collectorHashAtStart'] == after['collectorHashAtEnd']
assert before['appVersion'] == after['appVersion']
assert before['beforeSnapshot']['fingerprint'] == after['afterSnapshot']['fingerprint']
changed = [path for path, digest in before['sourceHashes'].items() if after['sourceHashes'][path] != digest]
assert changed == ['src/features/resources/wbs-view.module.css']
assert all(hashlib.sha256(Path(path).read_bytes()).hexdigest() == digest for path, digest in after['sourceHashes'].items())
rows = []
for width in [390, 768, 1024, 1440, 1920]:
    for root in ['kpi', 'milestone', 'process', 'equipment', 'system', 'resource']:
        key = f'{root}-{width}'
        b = load(out/'before'/f'{key}.json')
        a = load(out/'after'/f'{key}.json')
        bp, ap = b['metrics']['primary'], a['metrics']['primary']
        assert [value['text'] for value in bp['values']] == [value['text'] for value in ap['values']], (key, 'metric text changed')
        assert bp['valueCount'] == ap['valueCount'] and bp['rowCount'] == ap['rowCount'], (key, 'value/row count')
        assert b['facts']['document']['scrollWidth'] - b['facts']['document']['clientWidth'] == 0, key
        assert a['facts']['document']['scrollWidth'] - a['facts']['document']['clientWidth'] == 0, key
        if root == 'kpi':
            assert bp == ap, (key, 'KPI geometry KEEP')
        else:
            assert b['reports'][-1] == a['reports'][-1], (key, 'browser report snapshot/spec/filters/totals')
        def geometry(primary):
            return dict(firstSummaryY=primary['firstSummary']['y'], firstTableY=primary['table']['y'], fullyVisibleValues=primary['fullyVisibleValues'], valueCount=primary['valueCount'], fullyVisibleRows=primary['fullyVisibleRows'], rowCount=primary['rowCount'])
        rows.append(dict(key=key, before=geometry(bp), after=geometry(ap), tableShiftPx=ap['table']['y']-bp['table']['y']))
bs = load(out/'before/metric-details.json')
as_ = load(out/'after/metric-details.json')
assert bs['collectorSha256'] == as_['collectorSha256']
assert bs['widths'] == as_['widths'] == [1440]
assert bs['sourceStable'] and as_['sourceStable'] and not bs['faults']
# The original after close-up run is PARTIAL and is retained with its two readiness failures.
rs = load(out/'after/read-only-supplement.json')
assert rs['sourceStable'] and not rs['writes']
assert len(rs['rawReports']) == 5 and all(row['equal'] for row in rs['rawEquality'])
assert rs['sourceHashes'] == after['sourceHashes']
assert rs['canonicalBefore'] == rs['canonicalAfter']
assert rs['canonicalBefore']['hash'] == before['beforeSnapshot']['fingerprint']
assert not bs['writes'] and not as_['writes']
assert bs['sourceHashes'] == before['sourceHashes'] and as_['sourceHashes'] == after['sourceHashes']
assert bs['canonicalBefore'] == bs['canonicalAfter'] == as_['canonicalBefore'] == as_['canonicalAfter']
assert bs['canonicalBefore']['hash'] == before['beforeSnapshot']['fingerprint']
inventory = []
after_by_root = {row['root']: row for row in as_['results']}
readonly_by_root = {row['root']: row for row in rs['inventories']}
raw_by_root = {row['root']: row['data'] for row in rs['rawReports']}
for b in bs['results']:
    root = b['root']
    if root != 'kpi':
        assert b['reports'][-1] == raw_by_root[root], (root, 'FULL same-query raw Task/Assignment/Gate/configuration reports')
    a = after_by_root.get(root) or readonly_by_root.get(root)
    if a is None:
        inventory.append(dict(root=root, width=1440, closeup='NOT TESTED after readiness failure; standard30 and consumer E2E remain separate'))
        continue
    assert b['root'] == a['root'] and b['width'] == a['width']
    assert b['inventory']['documentOverflow'] == a['inventory']['documentOverflow'] == 0
    groups = []
    for bg, ag in zip(b['inventory']['metrics'], a['inventory']['metrics'], strict=True):
        assert bg['scope'] == ag['scope']
        assert [(item['label'], item['value']) for item in bg['items']] == [(item['label'], item['value']) for item in ag['items']]
        for item in ag['items']:
            assert item['valueStyle']['numeric'] == 'tabular-nums'
            assert float(item['labelStyle']['fontSize'][:-2]) < float(item['valueStyle']['fontSize'][:-2])
        groups.append(dict(scope=ag['scope'], labelsAndValues=[dict(label=item['label'], value=item['value']) for item in ag['items']]))
    inventory.append(dict(root=a['root'], width=a['width'], permission=a.get('permission', 'original editable supplemental run'), groups=groups, rawReportEqual=True if a['root'] != 'kpi' else 'N/A separate endpoint; KEEP geometry/source'))
result = dict(status='PASS', boundary='Local default-fixture Chromium only; not PR CI, final QA or Manager ACCEPT', beforeCheckoutHeadSha=before['sourceSha'], afterCheckoutHeadSha=after['sourceSha'], sourceWorkingTreeModified=True, sourceIdentity='Captured sourceHashes pin actual working-tree bytes; checkout HEAD is baseline only, not the final after/published source.', sourceChanges=changed, afterSourceHashes={path: after['sourceHashes'][path] for path in changed}, collectorSha256=after['collectorHashAtStart'], supplementaryCollectorSha256=as_['collectorSha256'], readonlySupplementCollectorSha256=rs['collectorSha256'], supplementaryOriginalAfter=dict(status='PARTIAL', completed=len(as_['results']), faults=as_['faults']), readonlySupplement=dict(status=rs['status'], inventories=len(rs['inventories']), faults=rs['faults'], boundary=rs['scope']), pairs=len(rows), kpiKeepPairs=5, fullRawReportEqualSpecs=5, canonicalRevision=as_['canonicalAfter']['revision'], canonicalFingerprint=as_['canonicalAfter']['hash'], projectMutations=0, geometry=rows, inventory1440=inventory, limitation='Typography and spacing improve readability; first-table movement is reported per view/width and is not asserted to universally improve. Raw report receipts are five independent exact default queries; browser totals/geometry are30 same-auth pairs. Supplemental closeups combine original4 editable with two separate readonly inventories when available; the original6 run remains PARTIAL and global header geometry is not compared across permission modes.')
(out/'comparison.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({key: value for key, value in result.items() if key not in ['geometry', 'inventory1440', 'afterSourceHashes']}, ensure_ascii=False))
