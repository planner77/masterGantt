"use client";

import { useMemo, useState } from "react";
import type { ProjectMasterAdminResponse, ProjectMasterRelationMutationRequest } from "@/contracts/project-master";
import styles from "./project-master-relations-editor.module.css";

interface Props {
  catalog: ProjectMasterAdminResponse;
  busy: boolean;
  mutate: (url: string, method: "POST" | "DELETE", body: ProjectMasterRelationMutationRequest) => Promise<boolean>;
}

export function ProjectMasterRelationsEditor({ catalog, busy, mutate }: Props) {
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [productId, setProductId] = useState("");
  const [siteEntityId, setSiteEntityId] = useState("");
  const [removeKey, setRemoveKey] = useState<string | null>(null);
  const { businessUnits, products, siteEntities, relations, items } = catalog.data;
  const names = useMemo(() => new Map(items.map((item) => [item.id, item.name])), [items]);
  const pairExists = relations.some((item) => item.businessUnitId === businessUnitId &&
    item.productId === productId && item.siteEntityId === null);
  const siteExists = relations.some((item) => item.businessUnitId === businessUnitId &&
    item.productId === productId && item.siteEntityId === siteEntityId);
  const add = async (site: boolean) => {
    if (!businessUnitId || !productId || (site && !siteEntityId)) return;
    await mutate("/api/project-master/admin/relations","POST",{
      businessUnitId, productId, siteEntityId: site ? siteEntityId : null,
    });
  };
  const remove = async (value: ProjectMasterRelationMutationRequest) => {
    const key = [value.businessUnitId,value.productId,value.siteEntityId ?? ""].join(":");
    if (removeKey !== key) { setRemoveKey(key); return; }
    setRemoveKey(null);
    await mutate("/api/project-master/admin/relations","DELETE",value);
  };
  return <section className={styles.section} aria-labelledby="project-master-relations-heading">
    <h3 id="project-master-relations-heading">기준정보 연결 관계</h3>
    <p>항목 자체와 별도로 사업부별 제품, 해당 사업부·제품 조합별 사업장/법인을 연결합니다. 이미 프로젝트에서 사용 중인 관계는 해제할 수 없습니다.</p>
    <div className={styles.controls}>
      <label>사업부
        <select disabled={busy} value={businessUnitId} onChange={(event) => { setBusinessUnitId(event.target.value);setProductId("");setSiteEntityId("");setRemoveKey(null); }}>
          <option value="">사업부 선택</option>
          {businessUnits.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
        </select>
      </label>
      <label>제품
        <select disabled={busy || !businessUnitId} value={productId} onChange={(event) => { setProductId(event.target.value);setSiteEntityId("");setRemoveKey(null); }}>
          <option value="">제품 선택</option>
          {products.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
        </select>
      </label>
      <button className="secondary-button" type="button" disabled={busy || !businessUnitId || !productId || pairExists} onClick={() => void add(false)}>제품 연결</button>
      <label>사업장/법인
        <select disabled={busy || !pairExists} value={siteEntityId} onChange={(event) => setSiteEntityId(event.target.value)}>
          <option value="">사업장/법인 선택</option>
          {siteEntities.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
        </select>
      </label>
      <button className="secondary-button" type="button" disabled={busy || !pairExists || !siteEntityId || siteExists} onClick={() => void add(true)}>사업장/법인 연결</button>
    </div>
    {relations.length === 0 ? <p role="status">등록된 연결 관계가 없습니다.</p> :
      <div className={styles.scroll}>
        <table className={styles.table} aria-label="사업부 제품 사업장 법인 연결 목록">
          <thead><tr><th scope="col">사업부</th><th scope="col">제품</th><th scope="col">사업장/법인</th><th scope="col">관계 작업</th></tr></thead>
          <tbody>{relations.map((item) => {
            const key=[item.businessUnitId,item.productId,item.siteEntityId ?? ""].join(":");
            return <tr key={key}>
              <td>{names.get(item.businessUnitId) ?? "미등록"}</td>
              <td>{names.get(item.productId) ?? "미등록"}</td>
              <td>{item.siteEntityId ? names.get(item.siteEntityId) ?? "미등록" : "제품 연결"}</td>
              <td><button type="button" className="secondary-button" disabled={busy}
                onClick={() => void remove(item)} aria-label={`${names.get(item.businessUnitId)} ${names.get(item.productId)} ${item.siteEntityId ? names.get(item.siteEntityId) : "제품"} 관계 해제`}>
                {removeKey === key ? "해제 확인" : "관계 해제"}
              </button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
  </section>;
}
