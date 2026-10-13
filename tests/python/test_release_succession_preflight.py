import copy
import unittest
from scripts.release_succession_preflight import (evaluate, SuccessionBlocked, ORIGINAL, CORRECTION, PUBLISHED_SHA, PUBLISHED_DIGEST, VERSIONS, CANDIDATE)

def valid():
    m="a"*40
    inv={v:dict(git_tag="ABSENT",git_sha=None,github_release="ABSENT",ghcr_tag="ABSENT",ghcr_digest=None) for v in (*VERSIONS,CANDIDATE)}
    inv["0.106.1"]=dict(git_tag="PRESENT",git_sha=PUBLISHED_SHA,github_release="ABSENT",ghcr_tag="PRESENT",ghcr_digest=PUBLISHED_DIGEST)
    return dict(source_sha=ORIGINAL,correction_sha=CORRECTION,main_sha=m,candidate_sha=m,candidate_version=CANDIDATE,first_parent=[PUBLISHED_SHA,ORIGINAL,CORRECTION,m],contains_f2=True,contains_correction=True,original_ci="FAIL",original_owner_marker_preserved=True,release_inventory=inv,published_candidate=dict(tag=f'ci-{PUBLISHED_SHA}',source_sha=PUBLISHED_SHA,status='PRESENT',digest=PUBLISHED_DIGEST),owner_new_version_authorized=False,evidence=dict(collector="trusted-main-read-only-v1",repository="planner77/masterGantt",main_sha=m,git_complete=True,github_releases_complete=True,ghcr_packages_complete=True,authenticated_registry=True,release_main_run="38215065244:1:SUCCESS",release_run="38221400193:2:SUCCESS",release_lifecycle_verified=True,source_633_owner_verified=True,retired_550=True,retired_615=True,revoked_550=True,revoked_615=True,revoked_616=True,successor_prepare_owner=True))

class TestSuccession(unittest.TestCase):
    def test_existing_release_with_no_github_release_object(self):
        result=evaluate(valid())
        self.assertEqual(result["decision"],"PREPARE_ONLY")
        self.assertFalse(result["publish"])
        self.assertFalse(result["retire"])
    def test_fail_closed(self):
        cases=[]
        for key,val in [("original_ci","PASS"),("candidate_version","0.107.0"),("owner_new_version_authorized",True)]:
            x=valid();x[key]=val;cases.append(x)
        for key,val in [("revoked_616",False),("ghcr_packages_complete",False),("release_run","38221400193:1:SUCCESS"),("source_633_owner_verified",False),("successor_prepare_owner",False)]:
            x=valid();x["evidence"][key]=val;cases.append(x)
        for v,k,val in [("0.106.1","ghcr_digest","sha256:"+"f"*64),("0.106.1","git_sha","b"*40),("0.105.0","git_tag","PRESENT"),("0.107.0","ghcr_tag","UNKNOWN"),("0.108.0","github_release","PRESENT")]:
            x=valid();x["release_inventory"][v][k]=val;cases.append(x)
        for key, value in [("status","ABSENT"),("status","UNKNOWN"),("tag","v0.106.1"),("digest","sha256:"+"f"*64),("source_sha","b"*40)]:
            x=valid();x["published_candidate"][key]=value;cases.append(x)
        x=valid();x["first_parent"].reverse();cases.append(x)
        x=valid();del x["evidence"]["authenticated_registry"];cases.append(x)
        for x in cases:
            with self.subTest(x=x),self.assertRaises(SuccessionBlocked): evaluate(copy.deepcopy(x))
if __name__=="__main__":unittest.main()
