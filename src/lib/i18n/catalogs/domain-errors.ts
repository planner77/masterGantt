/** Fixed domain UI status/error messages; business data is never translated. */
export const domainErrorsMessages = {
  " (선택 없음)": {
    "en": " (None selected)",
    "vi": " (Chưa chọn)"
  },
  " · Capacity 0의 계획 투입 경고": {
    "en": " · Planned allocation warning for Capacity 0",
    "vi": " · Cảnh báo huy động dự kiến khi Capacity bằng 0"
  },
  " · 기간 배정 없음(0부하)": {
    "en": " · No period assignment (zero load)",
    "vi": " · Không phân công theo kỳ (tải bằng 0)"
  },
  " · 미설정 포함": {
    "en": " · Include unset",
    "vi": " · Bao gồm chưa đặt"
  },
  " · 비근무기간": {
    "en": " · Non-working period",
    "vi": " · Khoảng thời gian không làm việc"
  },
  " · 알려진 부분합": {
    "en": " · Known subtotal",
    "vi": " · Tổng phụ đã biết"
  },
  "Excel 보고서 생성 실패": {
    "en": "Excel report generation failed",
    "vi": "Tạo báo cáo Excel thất bại"
  },
  "Excel 보고서를 내려받았습니다.": {
    "en": "Excel report downloaded.",
    "vi": "Đã tải xuống báo cáo Excel."
  },
  "Excel 보고서를 만들지 못했습니다. 다시 조회 후 시도하세요.": {
    "en": "Could not generate the Excel report. Reload and try again.",
    "vi": "Không thể tạo báo cáo Excel. Hãy tải lại rồi thử lại."
  },
  "KPI 조회 응답 버전이 일치하지 않습니다.": {
    "en": "The KPI response version does not match.",
    "vi": "Phiên bản phản hồi KPI không khớp."
  },
  "Milestone 교차": {
    "en": "Milestone intersection",
    "vi": "Giao với Milestone"
  },
  "Summary 하위 Task 범위": {
    "en": "Task scope under Summary",
    "vi": "Phạm vi Task bên dưới Summary"
  },
  "Target 미연결": {
    "en": "No Target linked",
    "vi": "Chưa liên kết Target"
  },
  "Target 정보 없음": {
    "en": "No Target information",
    "vi": "Không có thông tin Target"
  },
  "Task 개인 배정": {
    "en": "Individual Task assignment",
    "vi": "Phân công cá nhân cho Task"
  },
  "Task 개인 배정 없음": {
    "en": "No individual Task assignment",
    "vi": "Chưa phân công cá nhân cho Task"
  },
  "UTF-8 파일을 읽을 수 없습니다. 인코딩과 1 MiB 제한을 확인하세요.": {
    "en": "Could not read the UTF-8 file. Check the encoding and 1 MiB limit.",
    "vi": "Không thể đọc tệp UTF-8. Hãy kiểm tra mã hóa và giới hạn 1 MiB."
  },
  "WBS 범위": {
    "en": "WBS scope",
    "vi": "Phạm vi WBS"
  },
  "WorkArea 정보 없음": {
    "en": "No WorkArea information",
    "vi": "Không có thông tin WorkArea"
  },
  "같은 단계에는 설비와 시스템만 함께 배치할 수 있습니다.": {
    "en": "Only equipment and systems can share the same stage.",
    "vi": "Chỉ thiết bị và hệ thống có thể cùng nằm trong một tầng."
  },
  "개발자 역할을 배정하려면 리소스 관리에서 개발자 등급을 먼저 지정해 주세요.": {
    "en": "Set the developer grade in resource management before assigning the Developer role.",
    "vi": "Hãy đặt cấp bậc nhà phát triển trong quản lý nguồn lực trước khi phân công vai trò Nhà phát triển."
  },
  "개발자 역할을 배정하려면 리소스 관리에서 개발자 등급을 먼저 지정해야 합니다.": {
    "en": "A developer grade must be set in resource management before assigning the Developer role.",
    "vi": "Phải đặt cấp bậc nhà phát triển trong quản lý nguồn lực trước khi phân công vai trò Nhà phát triển."
  },
  "개인 미배정 Task · T0": {
    "en": "Tasks without an individual assignment · T0",
    "vi": "Task chưa phân công cá nhân · T0"
  },
  "견적·Excel": {
    "en": "Estimate · Excel",
    "vi": "Ước tính · Excel"
  },
  "공용 기준정보가 저장되었습니다. 현재 프로젝트에는 아직 미적용입니다. 현장 공정 다시 불러오기를 선택해 주세요.": {
    "en": "Shared master data was saved but has not been applied to this project. Select Reload site processes.",
    "vi": "Đã lưu dữ liệu danh mục dùng chung nhưng chưa áp dụng cho dự án này. Hãy chọn Tải lại công đoạn hiện trường."
  },
  "공정 ID": {
    "en": "Process ID",
    "vi": "ID công đoạn"
  },
  "공정 · WorkArea": {
    "en": "Process · WorkArea",
    "vi": "Công đoạn · WorkArea"
  },
  "공정 → Milestone → 리소스": {
    "en": "Process → Milestone → Resource",
    "vi": "Công đoạn → Milestone → Nguồn lực"
  },
  "공정 → WorkArea → 설비 / 물류 시스템 → 리소스": {
    "en": "Process → WorkArea → Equipment / Logistics system → Resource",
    "vi": "Công đoạn → WorkArea → Thiết bị / Hệ thống logistics → Nguồn lực"
  },
  "공정 기준정보 관리자 인증에 실패했습니다.": {
    "en": "Process master-data administrator authentication failed.",
    "vi": "Xác thực quản trị viên dữ liệu danh mục công đoạn thất bại."
  },
  "공정 기준정보가 변경되었습니다. WorkArea 목록을 다시 조회하고 연결을 확인한 뒤 저장해 주세요.": {
    "en": "Process master data changed. Reload the WorkArea list, verify the links, then save.",
    "vi": "Dữ liệu danh mục công đoạn đã thay đổi. Hãy tải lại danh sách WorkArea, kiểm tra liên kết rồi lưu."
  },
  "공정 기준정보를 불러오지 못했습니다.": {
    "en": "Could not load process master data.",
    "vi": "Không thể tải dữ liệu danh mục công đoạn."
  },
  "공정 기준정보를 저장했습니다.": {
    "en": "Process master data saved.",
    "vi": "Đã lưu dữ liệu danh mục công đoạn."
  },
  "공정 기준정보를 조회하지 못했습니다. 관리자 인증 상태를 확인하고 다시 조회해 주세요.": {
    "en": "Could not retrieve process master data. Check administrator authentication and reload.",
    "vi": "Không thể truy xuất dữ liệu danh mục công đoạn. Hãy kiểm tra xác thực quản trị viên rồi tải lại."
  },
  "공정 단독": {
    "en": "Process only",
    "vi": "Chỉ công đoạn"
  },
  "공정 문맥 버전": {
    "en": "Process context version",
    "vi": "Phiên bản ngữ cảnh công đoạn"
  },
  "공정 연결 서버에 연결할 수 없습니다. 입력 내용은 유지됩니다.": {
    "en": "Could not connect to the process-link server. Your input is preserved.",
    "vi": "Không thể kết nối máy chủ liên kết công đoạn. Nội dung nhập được giữ nguyên."
  },
  "공정 정보 없음": {
    "en": "No process information",
    "vi": "Không có thông tin công đoạn"
  },
  "공정 코드": {
    "en": "Process code",
    "vi": "Mã công đoạn"
  },
  "공정 확인 필요": {
    "en": "Process verification required",
    "vi": "Cần kiểm tra công đoạn"
  },
  "공정&WorkArea": {
    "en": "Processes & WorkArea",
    "vi": "Công đoạn & WorkArea"
  },
  "관공서 공휴일 기준": {
    "en": "Government-office holiday rules",
    "vi": "Quy định ngày nghỉ của cơ quan nhà nước"
  },
  "관련 물류 시스템": {
    "en": "Related logistics systems",
    "vi": "Hệ thống logistics liên quan"
  },
  "관리자 권한 또는 연결 상태를 확인하고 다시 시도해 주세요.": {
    "en": "Check administrator access or the connection and try again.",
    "vi": "Kiểm tra quyền quản trị viên hoặc kết nối rồi thử lại."
  },
  "관리자 비밀번호를 변경하지 못했습니다.": {
    "en": "Could not change the administrator password.",
    "vi": "Không thể thay đổi mật khẩu quản trị viên."
  },
  "관리자 비밀번호를 변경했습니다.": {
    "en": "Administrator password changed.",
    "vi": "Đã thay đổi mật khẩu quản trị viên."
  },
  "관리자 세션이 만료되었습니다. 다시 로그인해 주세요.": {
    "en": "The administrator session expired. Sign in again.",
    "vi": "Phiên quản trị viên đã hết hạn. Hãy đăng nhập lại."
  },
  "관리자 인증 서버에 연결할 수 없습니다.": {
    "en": "Could not connect to the administrator authentication server.",
    "vi": "Không thể kết nối máy chủ xác thực quản trị viên."
  },
  "관리자 인증에 실패했습니다.": {
    "en": "Administrator authentication failed.",
    "vi": "Xác thực quản trị viên thất bại."
  },
  "관점을 다시 선택해 주세요.": {
    "en": "Select the perspective again.",
    "vi": "Chọn lại góc nhìn."
  },
  "구성 참조": {
    "en": "Configuration reference",
    "vi": "Tham chiếu cấu hình"
  },
  "국가 캘린더 서버에 연결할 수 없습니다.": {
    "en": "Could not connect to the country-calendar server.",
    "vi": "Không thể kết nối máy chủ lịch quốc gia."
  },
  "국무원 연간 일정": {
    "en": "State Council annual schedule",
    "vi": "Lịch hằng năm của Quốc vụ viện"
  },
  "권한을 확인할 수 없습니다. 해당 편집 권한을 다시 활성화해 주세요.": {
    "en": "Could not verify access. Reactivate the required edit access.",
    "vi": "Không thể xác minh quyền truy cập. Hãy kích hoạt lại quyền chỉnh sửa tương ứng."
  },
  "그룹 활성 상태": {
    "en": "Group active status",
    "vi": "Trạng thái hoạt động của nhóm"
  },
  "금": {
    "en": "Fri",
    "vi": "Thứ Sáu"
  },
  "기간 투입": {
    "en": "Period allocation",
    "vi": "Huy động theo kỳ"
  },
  "기여 분포": {
    "en": "Contribution distribution",
    "vi": "Phân bố đóng góp"
  },
  "기존 공유 구역 (읽기 전용)": {
    "en": "Existing shared area (read-only)",
    "vi": "Khu vực dùng chung hiện có (chỉ đọc)"
  },
  "기존 구역 ID": {
    "en": "Existing area ID",
    "vi": "ID khu vực hiện có"
  },
  "기준정보 서버에 연결할 수 없습니다.": {
    "en": "Could not connect to the master-data server.",
    "vi": "Không thể kết nối máy chủ dữ liệu danh mục."
  },
  "내보내기 요청이 8 KiB 한도를 초과했습니다. 범위를 줄인 뒤 다시 확인해 주세요.": {
    "en": "The export request exceeds the 8 KiB limit. Reduce the scope and confirm again.",
    "vi": "Yêu cầu xuất vượt quá giới hạn 8 KiB. Hãy giảm phạm vi và xác nhận lại."
  },
  "다른 관리 변경이 먼저 저장되어 최신 목록을 다시 불러왔습니다.": {
    "en": "Another administrator change was saved first; the latest list has been reloaded.",
    "vi": "Một thay đổi quản trị khác đã được lưu trước; danh sách mới nhất đã được tải lại."
  },
  "다른 관리 변경이 먼저 저장되었습니다. 최신 목록을 불러왔습니다. 초안을 확인한 후 다시 저장해 주세요.": {
    "en": "Another administrator change was saved first. The latest list has been loaded. Review your draft before saving again.",
    "vi": "Một thay đổi quản trị khác đã được lưu trước. Danh sách mới nhất đã được tải. Hãy kiểm tra bản nháp trước khi lưu lại."
  },
  "다른 관리 변경이 먼저 저장되었습니다. 최신 목록을 확인한 후 다시 저장해 주세요.": {
    "en": "Another administrator change was saved first. Review the latest list before saving again.",
    "vi": "Một thay đổi quản trị khác đã được lưu trước. Hãy kiểm tra danh sách mới nhất trước khi lưu lại."
  },
  "다른 변경이 먼저 저장되었습니다. 초안을 보존했습니다. 취소한 뒤 최신 목록에서 다시 열어 주세요.": {
    "en": "Another change was saved first. Your draft is preserved. Cancel and reopen from the latest list.",
    "vi": "Một thay đổi khác đã được lưu trước. Bản nháp được giữ nguyên. Hãy hủy và mở lại từ danh sách mới nhất."
  },
  "다른 변경이 먼저 저장되었습니다. 최신 데이터와 초안을 비교한 뒤 다시 저장하세요.": {
    "en": "Another change was saved first. Compare the latest data with your draft before saving again.",
    "vi": "Một thay đổi khác đã được lưu trước. Hãy so sánh dữ liệu mới nhất với bản nháp trước khi lưu lại."
  },
  "다른 사용자에 의해 프로젝트가 갱신되었습니다. 최신 정보를 불러온 뒤 다시 시도해 주세요.": {
    "en": "Another user updated the project. Load the latest information and try again.",
    "vi": "Người dùng khác đã cập nhật dự án. Hãy tải thông tin mới nhất rồi thử lại."
  },
  "다른 사용자의 변경이 먼저 저장되었습니다. 최신 목록을 확인한 뒤 다시 시도해 주세요.": {
    "en": "Another user's change was saved first. Review the latest list and try again.",
    "vi": "Thay đổi của người dùng khác đã được lưu trước. Hãy kiểm tra danh sách mới nhất rồi thử lại."
  },
  "대시보드 응답이 현재 조회 조건과 일치하지 않습니다. 다시 시도해 주세요.": {
    "en": "The dashboard response does not match the current query conditions. Try again.",
    "vi": "Phản hồi bảng điều khiển không khớp với điều kiện truy vấn hiện tại. Hãy thử lại."
  },
  "대시보드를 불러오는 도중 오류가 발생했습니다.": {
    "en": "An error occurred while loading the dashboard.",
    "vi": "Đã xảy ra lỗi khi tải bảng điều khiển."
  },
  "대한민국": {
    "en": "South Korea",
    "vi": "Hàn Quốc"
  },
  "데이터가 변경되었습니다. 새로고침한 뒤 상세를 다시 열어 주세요.": {
    "en": "The data changed. Refresh and reopen the details.",
    "vi": "Dữ liệu đã thay đổi. Hãy làm mới và mở lại chi tiết."
  },
  "동적 계층 탐색": {
    "en": "Dynamic hierarchy navigation",
    "vi": "Điều hướng phân cấp động"
  },
  "동적 조회의 기간·기준일을 가져왔습니다. 나머지 보고서 조건은 유지했습니다.": {
    "en": "The period and reference date were taken from the dynamic view. Other report conditions were preserved.",
    "vi": "Đã lấy kỳ và ngày tham chiếu từ chế độ xem động. Các điều kiện báo cáo khác được giữ nguyên."
  },
  "등록 변경은 저장되었지만 프로젝트 최신 상태를 확인하지 못했습니다. 최신 상태를 조회해 주세요.": {
    "en": "Registration changes were saved, but the latest project state could not be verified. Reload the latest state.",
    "vi": "Đã lưu thay đổi đăng ký nhưng không thể xác minh trạng thái dự án mới nhất. Hãy tải lại trạng thái mới nhất."
  },
  "등록 정보를 확인할 수 없는 인력": {
    "en": "Personnel with unverified registration information",
    "vi": "Nhân sự có thông tin đăng ký chưa xác minh"
  },
  "등록된 유형이 없습니다.": {
    "en": "No types are registered.",
    "vi": "Chưa có loại nào được đăng ký."
  },
  "등록된 항목이 없습니다.": {
    "en": "No items are registered.",
    "vi": "Chưa có mục nào được đăng ký."
  },
  "등록만 됨 · Task 개인 배정 없음": {
    "en": "Registered only · No individual Task assignment",
    "vi": "Chỉ đăng ký · Chưa phân công cá nhân cho Task"
  },
  "리소스 → Milestone → 공정": {
    "en": "Resource → Milestone → Process",
    "vi": "Nguồn lực → Milestone → Công đoạn"
  },
  "리소스 → 공정 → WorkArea → 설비 / 물류 시스템": {
    "en": "Resource → Process → WorkArea → Equipment / Logistics system",
    "vi": "Nguồn lực → Công đoạn → WorkArea → Thiết bị / Hệ thống logistics"
  },
  "리소스 공수 정보를 불러오지 못했습니다. 입력 조건을 유지한 채 다시 시도할 수 있습니다.": {
    "en": "Could not load resource effort information. You can retry with the input conditions preserved.",
    "vi": "Không thể tải thông tin công sức nguồn lực. Bạn có thể thử lại với các điều kiện nhập được giữ nguyên."
  },
  "리소스 관리자 인증에 실패했습니다. 비밀번호와 서버 설정을 확인해 주세요.": {
    "en": "Resource administrator authentication failed. Check the password and server settings.",
    "vi": "Xác thực quản trị viên nguồn lực thất bại. Hãy kiểm tra mật khẩu và thiết lập máy chủ."
  },
  "리소스 그룹을 삭제했습니다.": {
    "en": "Resource group deleted.",
    "vi": "Đã xóa nhóm nguồn lực."
  },
  "리소스 단독": {
    "en": "Resource only",
    "vi": "Chỉ nguồn lực"
  },
  "리소스 목록을 확인하지 못했습니다. 다시 불러온 후 시도해 주세요.": {
    "en": "Could not verify the resource list. Reload it and try again.",
    "vi": "Không thể xác minh danh sách nguồn lực. Hãy tải lại rồi thử lại."
  },
  "리소스 카탈로그에 연결할 수 없습니다.": {
    "en": "Could not connect to the resource catalog.",
    "vi": "Không thể kết nối danh mục nguồn lực."
  },
  "리소스를 삭제했습니다.": {
    "en": "Resource deleted.",
    "vi": "Đã xóa nguồn lực."
  },
  "멕시코": {
    "en": "Mexico",
    "vi": "Mexico"
  },
  "목": {
    "en": "Thu",
    "vi": "Thứ Năm"
  },
  "목록에 연결할 수 없습니다. 다시 시도해 주세요.": {
    "en": "Could not connect to the list. Try again.",
    "vi": "Không thể kết nối danh sách. Hãy thử lại."
  },
  "물류 관리자 인증 서버에 연결할 수 없습니다.": {
    "en": "Could not connect to the logistics administrator authentication server.",
    "vi": "Không thể kết nối máy chủ xác thực quản trị viên logistics."
  },
  "물류 관리자 인증에 실패했습니다.": {
    "en": "Logistics administrator authentication failed.",
    "vi": "Xác thực quản trị viên logistics thất bại."
  },
  "물류 시스템 원본 ID": {
    "en": "Original logistics-system ID",
    "vi": "ID hệ thống logistics gốc"
  },
  "물류 유형 카탈로그에 연결할 수 없습니다.": {
    "en": "Could not connect to the logistics type catalog.",
    "vi": "Không thể kết nối danh mục loại logistics."
  },
  "미국": {
    "en": "United States",
    "vi": "Hoa Kỳ"
  },
  "미배정": {
    "en": "Unassigned",
    "vi": "Chưa phân công"
  },
  "베트남": {
    "en": "Vietnam",
    "vi": "Việt Nam"
  },
  "변경 결과를 확인할 수 없습니다.": {
    "en": "Could not verify the change result.",
    "vi": "Không thể xác minh kết quả thay đổi."
  },
  "변경 결과를 확인할 수 없습니다. 목록을 다시 확인한 후 저장해 주세요.": {
    "en": "Could not verify the change result. Check the list again before saving.",
    "vi": "Không thể xác minh kết quả thay đổi. Hãy kiểm tra lại danh sách trước khi lưu."
  },
  "변경사항을 저장하지 못했습니다. 입력값과 중복 코드를 확인해 주세요.": {
    "en": "Could not save changes. Check input values and duplicate codes.",
    "vi": "Không thể lưu thay đổi. Hãy kiểm tra giá trị nhập và mã trùng lặp."
  },
  "변경사항을 저장했습니다.": {
    "en": "Changes saved.",
    "vi": "Đã lưu thay đổi."
  },
  "변경을 저장하지 못했습니다.": {
    "en": "Could not save the changes.",
    "vi": "Không thể lưu thay đổi."
  },
  "변경을 저장했습니다. 기존 프로젝트는 자동 변경되지 않습니다.": {
    "en": "Changes saved. Existing projects are not changed automatically.",
    "vi": "Đã lưu thay đổi. Các dự án hiện có không tự động thay đổi."
  },
  "보조제어": {
    "en": "Auxiliary control",
    "vi": "Điều khiển phụ"
  },
  "브라우저 저장소를 사용할 수 없어 이번 화면에서만 구성을 유지합니다.": {
    "en": "Browser storage is unavailable; the configuration will be kept only on this screen.",
    "vi": "Không thể sử dụng bộ nhớ trình duyệt; cấu hình chỉ được giữ trên màn hình này."
  },
  "비밀번호 변경 결과를 확인할 수 없습니다.": {
    "en": "Could not verify the password change result.",
    "vi": "Không thể xác minh kết quả thay đổi mật khẩu."
  },
  "비활성 리소스는 새로 등록할 수 없습니다. 공용 리소스 관리자에게 확인해 주세요.": {
    "en": "Inactive resources cannot be newly registered. Contact the shared resource administrator.",
    "vi": "Không thể đăng ký mới nguồn lực không hoạt động. Hãy liên hệ quản trị viên nguồn lực dùng chung."
  },
  "비활성 상태의 항목이 없습니다.": {
    "en": "No inactive items.",
    "vi": "Không có mục không hoạt động."
  },
  "비활성 유형이 없습니다.": {
    "en": "No inactive types.",
    "vi": "Không có loại không hoạt động."
  },
  "비활성화된 리소스는 새로 배정할 수 없습니다.": {
    "en": "Inactive resources cannot receive new assignments.",
    "vi": "Không thể tạo phân công mới cho nguồn lực không hoạt động."
  },
  "사용 중이거나 중복되는 구역입니다. 연결을 확인하거나 비활성화를 사용해 주세요.": {
    "en": "This area is in use or duplicated. Check the links or deactivate it instead.",
    "vi": "Khu vực này đang được sử dụng hoặc trùng lặp. Hãy kiểm tra liên kết hoặc chuyển sang không hoạt động."
  },
  "사용 중이거나 중복되는 항목입니다. 연결 관계를 확인하거나 비활성화를 사용해 주세요.": {
    "en": "This item is in use or duplicated. Check the relationships or deactivate it instead.",
    "vi": "Mục này đang được sử dụng hoặc trùng lặp. Hãy kiểm tra quan hệ hoặc chuyển sang không hoạt động."
  },
  "사용 중인 기준정보 코드나 연결 관계는 변경·해제할 수 없습니다. 하위 관계와 프로젝트 사용 여부를 확인하세요.": {
    "en": "Master-data codes and relationships in use cannot be changed or removed. Check child relationships and project usage.",
    "vi": "Không thể thay đổi hoặc xóa mã dữ liệu danh mục và quan hệ đang được sử dụng. Hãy kiểm tra quan hệ con và việc sử dụng trong dự án."
  },
  "산정 불가 · 공수 미설정": {
    "en": "Not calculable · Effort not set",
    "vi": "Không thể tính · Chưa đặt công sức"
  },
  "상세 전체 범위": {
    "en": "Full detail scope",
    "vi": "Toàn bộ phạm vi chi tiết"
  },
  "상세 조회에 실패했습니다.": {
    "en": "Failed to load details.",
    "vi": "Không thể tải chi tiết."
  },
  "상위 작업 확인 필요": {
    "en": "Parent task verification required",
    "vi": "Cần kiểm tra tác vụ cha"
  },
  "상태 미지정": {
    "en": "Status not set",
    "vi": "Chưa đặt trạng thái"
  },
  "새 관리자 비밀번호는 1~12자이며 확인 값이 일치해야 합니다.": {
    "en": "The new administrator password must contain 1–12 characters and match the confirmation.",
    "vi": "Mật khẩu quản trị viên mới phải có từ 1 đến 12 ký tự và khớp với xác nhận."
  },
  "새 비밀번호는 1~12자이며 확인 값이 일치해야 합니다.": {
    "en": "The new password must contain 1–12 characters and match the confirmation.",
    "vi": "Mật khẩu mới phải có từ 1 đến 12 ký tự và khớp với xác nhận."
  },
  "서버 로그아웃을 확인하지 못했습니다. 관리 화면을 잠갔습니다.": {
    "en": "Could not confirm server logout. The management screen has been locked.",
    "vi": "Không thể xác nhận đăng xuất máy chủ. Màn hình quản lý đã bị khóa."
  },
  "서버 연결이 끊겨 저장 결과가 불확실합니다. 초안은 유지됩니다. 취소한 뒤 새로고침으로 확인해 주세요.": {
    "en": "The server connection was lost, so the save result is uncertain. Your draft is preserved. Cancel, then refresh to check.",
    "vi": "Mất kết nối máy chủ nên kết quả lưu chưa chắc chắn. Bản nháp được giữ nguyên. Hãy hủy rồi làm mới để kiểm tra."
  },
  "서버 처리 중 오류가 발생했습니다.": {
    "en": "An error occurred during server processing.",
    "vi": "Đã xảy ra lỗi khi máy chủ xử lý."
  },
  "서버에 연결할 수 없습니다. 입력 내용은 유지됩니다.": {
    "en": "Could not connect to the server. Your input is preserved.",
    "vi": "Không thể kết nối máy chủ. Nội dung nhập được giữ nguyên."
  },
  "서버의 로그아웃 결과를 확인할 수 없습니다. 화면 편집은 잠겼습니다.": {
    "en": "Could not verify server logout. Editing on this screen is locked.",
    "vi": "Không thể xác minh kết quả đăng xuất máy chủ. Chỉnh sửa trên màn hình đã bị khóa."
  },
  "선택 공수 미설정 Assignment": {
    "en": "Selected Assignment with effort unset",
    "vi": "Assignment đã chọn chưa đặt công sức"
  },
  "선택 근거가 최신 조건에서 제외되었습니다. 기간 상세를 닫고 현재 Plan에서 다시 선택해 주세요.": {
    "en": "The selected basis is excluded by the latest conditions. Close period details and select again from the current Plan.",
    "vi": "Căn cứ đã chọn bị loại bởi điều kiện mới nhất. Hãy đóng chi tiết kỳ và chọn lại từ Plan hiện tại."
  },
  "선택 범위 할당 Task": {
    "en": "Assigned Tasks in selected scope",
    "vi": "Task được phân công trong phạm vi đã chọn"
  },
  "선택 이후 원본이 변경되었습니다. 최신 목록을 불러온 뒤 다시 선택해 주세요.": {
    "en": "The source changed after selection. Load the latest list and select again.",
    "vi": "Nguồn đã thay đổi sau khi chọn. Hãy tải danh sách mới nhất và chọn lại."
  },
  "선택 항목 정보 확인 필요": {
    "en": "Selected item verification required",
    "vi": "Cần kiểm tra thông tin mục đã chọn"
  },
  "선택 항목이 삭제되거나 프로젝트에서 해제되었습니다. 해당 조건을 해제하거나 초기화해 주세요.": {
    "en": "The selected item was deleted or removed from the project. Clear that condition or reset the filters.",
    "vi": "Mục đã chọn đã bị xóa hoặc gỡ khỏi dự án. Hãy xóa điều kiện đó hoặc đặt lại bộ lọc."
  },
  "선택한 리소스 원본을 현재 프로젝트에서 확인하지 못했습니다. 최신 조회로 돌아가 다시 선택해 주세요.": {
    "en": "The selected resource source could not be verified in this project. Return to the latest view and select again.",
    "vi": "Không thể xác minh nguồn lực gốc đã chọn trong dự án này. Hãy quay lại chế độ xem mới nhất và chọn lại."
  },
  "선택한 작업 구역 원본을 확인할 수 없습니다. 최신 조회에서 다시 선택해 주세요.": {
    "en": "Could not verify the selected work-area source. Select again from the latest view.",
    "vi": "Không thể xác minh khu vực làm việc gốc đã chọn. Hãy chọn lại từ chế độ xem mới nhất."
  },
  "선택한 작업 구역의 소유 공정을 목록에서 선택해 주세요.": {
    "en": "Select the owning process of the selected work area from the list.",
    "vi": "Chọn công đoạn sở hữu khu vực làm việc đã chọn từ danh sách."
  },
  "설비 단독": {
    "en": "Equipment only",
    "vi": "Chỉ thiết bị"
  },
  "설비 원본 ID": {
    "en": "Original equipment ID",
    "vi": "ID thiết bị gốc"
  },
  "설비 유형 코드": {
    "en": "Equipment type code",
    "vi": "Mã loại thiết bị"
  },
  "설비 종류": {
    "en": "Equipment type",
    "vi": "Loại thiết bị"
  },
  "설비 종류 · 인스턴스": {
    "en": "Equipment type · Instance",
    "vi": "Loại thiết bị · Phiên bản thiết bị"
  },
  "설비가 연결되어 있거나 하위 시스템으로 조율 중인 시스템은 삭제할 수 없습니다. 연결을 먼저 해제해 주세요.": {
    "en": "A system linked to equipment or coordinating child systems cannot be deleted. Remove the links first.",
    "vi": "Không thể xóa hệ thống đang liên kết thiết bị hoặc điều phối hệ thống con. Hãy gỡ liên kết trước."
  },
  "설비를 등록하려면 먼저 공정을 최소 1개 이상 생성해야 합니다.": {
    "en": "Create at least one process before registering equipment.",
    "vi": "Tạo ít nhất một công đoạn trước khi đăng ký thiết bị."
  },
  "수": {
    "en": "Wed",
    "vi": "Thứ Tư"
  },
  "시스템 → Milestone → 공정": {
    "en": "System → Milestone → Process",
    "vi": "Hệ thống → Milestone → Công đoạn"
  },
  "시스템 → 공정 → WorkArea → 설비 → 리소스": {
    "en": "System → Process → WorkArea → Equipment → Resource",
    "vi": "Hệ thống → Công đoạn → WorkArea → Thiết bị → Nguồn lực"
  },
  "시스템 단독": {
    "en": "System only",
    "vi": "Chỉ hệ thống"
  },
  "시스템 설정은 물류 시스템 관점에서만 사용할 수 있습니다.": {
    "en": "System settings are available only in the logistics-system perspective.",
    "vi": "Thiết lập hệ thống chỉ có trong góc nhìn hệ thống logistics."
  },
  "시스템 연결 범위: 조율 범위 포함": {
    "en": "System link scope: including coordination",
    "vi": "Phạm vi liên kết hệ thống: bao gồm điều phối"
  },
  "시스템 정보 없음": {
    "en": "No system information",
    "vi": "Không có thông tin hệ thống"
  },
  "시스템 조율 관계에서 순환(사이클)이 감지되었습니다. 방향성 연계(DAG) 규칙을 확인해 주세요.": {
    "en": "A cycle was detected in system coordination relationships. Check the directed acyclic graph (DAG) rules.",
    "vi": "Phát hiện chu trình trong quan hệ điều phối hệ thống. Hãy kiểm tra quy tắc đồ thị có hướng không chu trình (DAG)."
  },
  "시스템 종류": {
    "en": "System type",
    "vi": "Loại hệ thống"
  },
  "시스템 종류 · 인스턴스": {
    "en": "System type · Instance",
    "vi": "Loại hệ thống · Phiên bản hệ thống"
  },
  "시스템 필터를 다시 선택해 주세요.": {
    "en": "Select the system filter again.",
    "vi": "Chọn lại bộ lọc hệ thống."
  },
  "알려진 부분 ": {
    "en": "Known portion ",
    "vi": "Phần đã biết "
  },
  "업무 집중": {
    "en": "Work focus",
    "vi": "Tập trung công việc"
  },
  "역할": {
    "en": "Role",
    "vi": "Vai trò"
  },
  "역할만 있음 · Task 개인 배정 없음": {
    "en": "Role only · No individual Task assignment",
    "vi": "Chỉ có vai trò · Chưa phân công cá nhân cho Task"
  },
  "연결 원본 ID": {
    "en": "Original link ID",
    "vi": "ID liên kết gốc"
  },
  "연결 확인 필요": {
    "en": "Link verification required",
    "vi": "Cần kiểm tra liên kết"
  },
  "연방노동법 일반 의무휴무일": {
    "en": "General mandatory rest days under Federal Labor Law",
    "vi": "Ngày nghỉ bắt buộc chung theo Luật Lao động Liên bang"
  },
  "연방직원": {
    "en": "Federal employees",
    "vi": "Nhân viên liên bang"
  },
  "완료 Task": {
    "en": "Completed Tasks",
    "vi": "Task đã hoàn thành"
  },
  "요청을 처리할 수 없습니다 (충돌 발생).": {
    "en": "Could not process the request (conflict).",
    "vi": "Không thể xử lý yêu cầu (xung đột)."
  },
  "원본 snapshot이 변경되었거나 확인할 수 없습니다. 새로고침 후 다시 선택해 주세요.": {
    "en": "The source snapshot changed or could not be verified. Refresh and select again.",
    "vi": "Snapshot nguồn đã thay đổi hoặc không thể xác minh. Hãy làm mới và chọn lại."
  },
  "원본 이름 확인 필요": {
    "en": "Original name verification required",
    "vi": "Cần kiểm tra tên gốc"
  },
  "원본 출처가 변경되었습니다.": {
    "en": "The original source changed.",
    "vi": "Nguồn gốc đã thay đổi."
  },
  "원본 확인에 실패했습니다. 새로고침 후 다시 시도해 주세요.": {
    "en": "Source verification failed. Refresh and try again.",
    "vi": "Xác minh nguồn thất bại. Hãy làm mới rồi thử lại."
  },
  "원본의 관련 작업을 확인하지 못해 저장을 차단했습니다. 초안은 유지됩니다. 최신 정보를 다시 조회해 주세요.": {
    "en": "Saving was blocked because related tasks in the source could not be verified. Your draft is preserved. Reload the latest information.",
    "vi": "Đã chặn lưu vì không thể xác minh tác vụ liên quan trong nguồn. Bản nháp được giữ nguyên. Hãy tải lại thông tin mới nhất."
  },
  "원본이 바뀌었습니다. 차트를 새로 조회하세요.": {
    "en": "The source changed. Reload the chart.",
    "vi": "Nguồn đã thay đổi. Hãy tải lại biểu đồ."
  },
  "원본이 변경되었습니다. 새로고침 후 다시 선택하세요.": {
    "en": "The source changed. Refresh and select again.",
    "vi": "Nguồn đã thay đổi. Hãy làm mới và chọn lại."
  },
  "이 변경을 저장할 권한이 없습니다. 관리자 권한을 확인한 후 다시 시도해 주세요.": {
    "en": "You are not authorized to save this change. Check administrator access and try again.",
    "vi": "Bạn không có quyền lưu thay đổi này. Hãy kiểm tra quyền quản trị viên rồi thử lại."
  },
  "이 프로젝트의 리소스를 변경할 권한이 없습니다.": {
    "en": "You are not authorized to change resources in this project.",
    "vi": "Bạn không có quyền thay đổi nguồn lực trong dự án này."
  },
  "이름 정렬: 내림차순": {
    "en": "Name sort: descending",
    "vi": "Sắp xếp tên: giảm dần"
  },
  "이름과 코드를 입력해 주세요.": {
    "en": "Enter a name and code.",
    "vi": "Nhập tên và mã."
  },
  "이미 동일한 공정 코드가 존재합니다. 다른 코드를 사용해 주세요.": {
    "en": "This process code already exists. Use another code.",
    "vi": "Mã công đoạn này đã tồn tại. Hãy dùng mã khác."
  },
  "이미 동일한 리소스와 역할 조합이 추가되어 있습니다.": {
    "en": "This resource/role combination has already been added.",
    "vi": "Tổ hợp nguồn lực/vai trò này đã được thêm."
  },
  "이미 동일한 설비 코드가 존재합니다. 다른 코드를 사용해 주세요.": {
    "en": "This equipment code already exists. Use another code.",
    "vi": "Mã thiết bị này đã tồn tại. Hãy dùng mã khác."
  },
  "이미 동일한 시스템 코드가 존재합니다. 다른 코드를 사용해 주세요.": {
    "en": "This system code already exists. Use another code.",
    "vi": "Mã hệ thống này đã tồn tại. Hãy dùng mã khác."
  },
  "이전 버전의 조회 구성입니다. 초기화해 주세요.": {
    "en": "This view configuration is from an older version. Reset it.",
    "vi": "Cấu hình chế độ xem này thuộc phiên bản cũ. Hãy đặt lại."
  },
  "일정 없음": {
    "en": "No schedule",
    "vi": "Không có lịch trình"
  },
  "임박 기준은 1~90 사이의 정수로 입력해 주세요.": {
    "en": "The upcoming threshold must be an integer from 1 to 90.",
    "vi": "Ngưỡng sắp đến phải là số nguyên từ 1 đến 90."
  },
  "작업 구역을 삭제했습니다.": {
    "en": "Work area deleted.",
    "vi": "Đã xóa khu vực làm việc."
  },
  "작업 구역을 저장했습니다.": {
    "en": "Work area saved.",
    "vi": "Đã lưu khu vực làm việc."
  },
  "작업 구역을 조회하지 못했습니다. 0개로 처리하지 않습니다. 새로고침을 선택해 주세요.": {
    "en": "Could not retrieve work areas. This is not treated as zero results. Select Refresh.",
    "vi": "Không thể truy xuất khu vực làm việc. Không xem đây là kết quả bằng 0. Hãy chọn Làm mới."
  },
  "작업 또는 기존 연결에서 참조 중인 설비의 WorkArea 연결은 변경할 수 없습니다. 기존 연결과 입력한 초안은 유지됩니다.": {
    "en": "WorkArea links cannot be changed for equipment referenced by tasks or existing links. Existing links and your draft are preserved.",
    "vi": "Không thể thay đổi liên kết WorkArea của thiết bị được tác vụ hoặc liên kết hiện có tham chiếu. Liên kết hiện có và bản nháp được giữ nguyên."
  },
  "작업 배정 또는 책임 역할에서 사용 중이므로 등록을 해제할 수 없습니다. 기존 사용을 먼저 정리해 주세요.": {
    "en": "Registration cannot be removed while used by task assignments or responsibility roles. Resolve existing usage first.",
    "vi": "Không thể gỡ đăng ký khi đang được phân công tác vụ hoặc vai trò trách nhiệm sử dụng. Hãy xử lý việc sử dụng hiện có trước."
  },
  "작업 배정을 불러오지 못했습니다. 닫고 다시 시도해 주세요.": {
    "en": "Could not load task assignments. Close and try again.",
    "vi": "Không thể tải phân công tác vụ. Hãy đóng rồi thử lại."
  },
  "작업 배정이 변경되었습니다. 최신 상태를 조회한 뒤 다시 열어 주세요.": {
    "en": "Task assignments changed. Load the latest state and reopen.",
    "vi": "Phân công tác vụ đã thay đổi. Hãy tải trạng thái mới nhất và mở lại."
  },
  "작업 상속": {
    "en": "Task inheritance",
    "vi": "Kế thừa tác vụ"
  },
  "저장 결과를 확인하지 못했습니다. 목록을 다시 확인한 후 저장해 주세요.": {
    "en": "Could not verify the save result. Check the list again before saving.",
    "vi": "Không thể xác minh kết quả lưu. Hãy kiểm tra lại danh sách trước khi lưu."
  },
  "저장 결과를 확인하지 못했습니다. 새로고침 후 다시 확인해 주세요.": {
    "en": "Could not verify the save result. Refresh and check again.",
    "vi": "Không thể xác minh kết quả lưu. Hãy làm mới rồi kiểm tra lại."
  },
  "저장 결과를 확인하지 못했습니다. 적용되었을 수 있으므로 최신 상태를 조회한 뒤 다시 검토해 주세요.": {
    "en": "Could not verify the save result. It may have been applied; load the latest state and review again.",
    "vi": "Không thể xác minh kết quả lưu. Thay đổi có thể đã được áp dụng; hãy tải trạng thái mới nhất và kiểm tra lại."
  },
  "저장 결과를 확인할 수 없습니다. 입력 내용을 보존하고 최신 목록에서 확인해 주세요.": {
    "en": "Could not verify the save result. Preserve your input and check the latest list.",
    "vi": "Không thể xác minh kết quả lưu. Hãy giữ nội dung nhập và kiểm tra danh sách mới nhất."
  },
  "저장 결과를 확인할 수 없습니다. 최신 데이터를 다시 조회하세요.": {
    "en": "Could not verify the save result. Reload the latest data.",
    "vi": "Không thể xác minh kết quả lưu. Hãy tải lại dữ liệu mới nhất."
  },
  "저장 후 현재 페이지에 배정이 없어 첫 페이지로 돌아왔습니다.": {
    "en": "No assignments remain on the current page after saving, so the first page is shown.",
    "vi": "Không còn phân công trên trang hiện tại sau khi lưu nên đã quay về trang đầu."
  },
  "저장된 조회 구성을 사용할 수 없습니다. 기본 구성으로 초기화하거나 다시 적용해 주세요.": {
    "en": "The saved view configuration is unavailable. Reset to the default configuration or apply it again.",
    "vi": "Không thể sử dụng cấu hình chế độ xem đã lưu. Hãy đặt lại cấu hình mặc định hoặc áp dụng lại."
  },
  "저장하지 못했습니다. 필수 항목과 활성 상태를 확인한 뒤 다시 시도해 주세요.": {
    "en": "Could not save. Check required fields and active status, then try again.",
    "vi": "Không thể lưu. Hãy kiểm tra trường bắt buộc và trạng thái hoạt động rồi thử lại."
  },
  "전국 공식 휴일": {
    "en": "National official holidays",
    "vi": "Ngày nghỉ chính thức toàn quốc"
  },
  "전국 금융기관 공통": {
    "en": "Common to financial institutions nationwide",
    "vi": "Áp dụng chung cho tổ chức tài chính toàn quốc"
  },
  "전체(개인 고유 합계)": {
    "en": "Total (unique individuals)",
    "vi": "Tổng (cá nhân không trùng lặp)"
  },
  "정렬은 0~1000000의 정수로 입력해 주세요.": {
    "en": "Sort order must be an integer from 0 to 1000000.",
    "vi": "Thứ tự sắp xếp phải là số nguyên từ 0 đến 1000000."
  },
  "제어 시스템에 연결된 설비이므로 삭제할 수 없습니다. 시스템 연결을 먼저 해제하거나 비활성화해 주세요.": {
    "en": "This equipment is linked to a control system and cannot be deleted. Remove the system link first or deactivate it.",
    "vi": "Thiết bị này liên kết với hệ thống điều khiển nên không thể xóa. Hãy gỡ liên kết hệ thống trước hoặc chuyển sang không hoạt động."
  },
  "조회 구성을 초기화해 주세요.": {
    "en": "Reset the view configuration.",
    "vi": "Đặt lại cấu hình chế độ xem."
  },
  "조회 권한을 확인해 주세요. 프로젝트를 다시 열어 접근 상태를 확인할 수 있습니다.": {
    "en": "Check read access. Reopen the project to verify your access state.",
    "vi": "Kiểm tra quyền đọc. Hãy mở lại dự án để xác minh trạng thái truy cập."
  },
  "조회 단계를 다시 구성해 주세요.": {
    "en": "Reconfigure the query stages.",
    "vi": "Cấu hình lại các tầng truy vấn."
  },
  "조회 대상": {
    "en": "Query target",
    "vi": "Đối tượng truy vấn"
  },
  "조회 요청에 실패했습니다. 다시 시도해 주세요.": {
    "en": "The query request failed. Try again.",
    "vi": "Yêu cầu truy vấn thất bại. Hãy thử lại."
  },
  "조회 응답 버전이 일치하지 않습니다.": {
    "en": "The query response version does not match.",
    "vi": "Phiên bản phản hồi truy vấn không khớp."
  },
  "조회 응답의 출처가 일치하지 않습니다. 다시 조회해 주세요.": {
    "en": "The query response source does not match. Reload it.",
    "vi": "Nguồn phản hồi truy vấn không khớp. Hãy tải lại."
  },
  "조회 조건": {
    "en": "Query conditions",
    "vi": "Điều kiện truy vấn"
  },
  "조회 한도를 초과했습니다. 기간·선택 범위를 줄여 주세요. 프로젝트 전체 한도는 필터로 줄일 수 없습니다.": {
    "en": "The query limit was exceeded. Reduce the period or selected scope. Project-wide limits cannot be reduced with filters.",
    "vi": "Đã vượt giới hạn truy vấn. Hãy giảm kỳ hoặc phạm vi đã chọn. Không thể giảm giới hạn toàn dự án bằng bộ lọc."
  },
  "조회하지 못했습니다.": {
    "en": "Could not retrieve data.",
    "vi": "Không thể truy xuất dữ liệu."
  },
  "주 담당자(Primary)는 '설비 담당(owner)' 역할에만 지정 가능합니다.": {
    "en": "Primary can be assigned only to the Equipment owner (owner) role.",
    "vi": "Chỉ có thể đặt Primary cho vai trò Phụ trách thiết bị (owner)."
  },
  "주 책임자(Primary)는 'PI(책임자)' 역할에만 지정 가능합니다.": {
    "en": "Primary can be assigned only to the PI (responsible person) role.",
    "vi": "Chỉ có thể đặt Primary cho vai trò PI (người chịu trách nhiệm)."
  },
  "주5일 공공기관 직원": {
    "en": "Public-sector employees working five days a week",
    "vi": "Nhân viên khu vực công làm việc năm ngày mỗi tuần"
  },
  "주제어": {
    "en": "Main control",
    "vi": "Điều khiển chính"
  },
  "중국": {
    "en": "China",
    "vi": "Trung Quốc"
  },
  "지원하는 조회 축을 선택해 주세요.": {
    "en": "Select a supported query axis.",
    "vi": "Chọn trục truy vấn được hỗ trợ."
  },
  "직접 또는 조율 조회를 선택해 주세요.": {
    "en": "Select a direct or coordination query.",
    "vi": "Chọn truy vấn trực tiếp hoặc điều phối."
  },
  "진척 미산정": {
    "en": "Progress not calculated",
    "vi": "Chưa tính tiến độ"
  },
  "차트 조회에 실패했습니다.": {
    "en": "Failed to load the chart.",
    "vi": "Không thể tải biểu đồ."
  },
  "최상위 관점을 포함하여 각 축은 한 번만 사용할 수 있습니다.": {
    "en": "Each axis can be used only once, including the top-level perspective.",
    "vi": "Mỗi trục chỉ được dùng một lần, bao gồm góc nhìn cấp cao nhất."
  },
  "최상위 관점을 포함하여 최대 8단계입니다.": {
    "en": "A maximum of 8 stages is allowed, including the top-level perspective.",
    "vi": "Cho phép tối đa 8 tầng, bao gồm góc nhìn cấp cao nhất."
  },
  "최신 국가 캘린더를 불러오지 못했습니다.": {
    "en": "Could not load the latest country calendar.",
    "vi": "Không thể tải lịch quốc gia mới nhất."
  },
  "최신 기준정보 조회에 실패했습니다.": {
    "en": "Failed to retrieve the latest master data.",
    "vi": "Không thể truy xuất dữ liệu danh mục mới nhất."
  },
  "최신 기준정보를 불러오지 못했습니다.": {
    "en": "Could not load the latest master data.",
    "vi": "Không thể tải dữ liệu danh mục mới nhất."
  },
  "최신 기준정보를 조회했습니다. 기존 편집 창은 닫고 최신 항목을 다시 열어 주세요.": {
    "en": "The latest master data has been loaded. Close existing editors and reopen the latest items.",
    "vi": "Đã tải dữ liệu danh mục mới nhất. Hãy đóng cửa sổ chỉnh sửa hiện có và mở lại mục mới nhất."
  },
  "최신 데이터로 갱신했습니다. 내용을 확인하고 새 미리보기를 계산하세요.": {
    "en": "Updated to the latest data. Review it and calculate a new preview.",
    "vi": "Đã cập nhật dữ liệu mới nhất. Hãy kiểm tra và tính bản xem trước mới."
  },
  "최신 목록을 확인하지 못했습니다. 목록을 다시 불러온 후 변경해 주세요.": {
    "en": "Could not verify the latest list. Reload it before making changes.",
    "vi": "Không thể xác minh danh sách mới nhất. Hãy tải lại trước khi thay đổi."
  },
  "최신 물류 유형 목록을 불러오지 못했습니다.": {
    "en": "Could not load the latest logistics type list.",
    "vi": "Không thể tải danh sách loại logistics mới nhất."
  },
  "태국": {
    "en": "Thailand",
    "vi": "Thái Lan"
  },
  "토": {
    "en": "Sat",
    "vi": "Thứ Bảy"
  },
  "파일 검증 서버에 연결할 수 없습니다.": {
    "en": "Could not connect to the file-validation server.",
    "vi": "Không thể kết nối máy chủ kiểm tra tệp."
  },
  "파일 검증에 실패했습니다.": {
    "en": "File validation failed.",
    "vi": "Kiểm tra tệp thất bại."
  },
  "파일은 UTF-8 기준 1 MiB 이하여야 합니다.": {
    "en": "Files must be UTF-8 and no larger than 1 MiB.",
    "vi": "Tệp phải được mã hóa UTF-8 và không lớn hơn 1 MiB."
  },
  "편집 권한을 확인해 주세요. 입력 내용은 유지됩니다.": {
    "en": "Check edit access. Your input is preserved.",
    "vi": "Kiểm tra quyền chỉnh sửa. Nội dung nhập được giữ nguyên."
  },
  "편집 권한이 만료되었습니다. 상단의 편집 잠금 해제를 다시 진행해 주세요.": {
    "en": "Edit access expired. Unlock editing again at the top of the screen.",
    "vi": "Quyền chỉnh sửa đã hết hạn. Hãy mở khóa chỉnh sửa lại ở đầu màn hình."
  },
  "편집 세션이 만료되었습니다. 프로젝트 편집 잠금을 다시 해제해 주세요.": {
    "en": "The edit session expired. Unlock project editing again.",
    "vi": "Phiên chỉnh sửa đã hết hạn. Hãy mở khóa chỉnh sửa dự án lại."
  },
  "표준 변경점을 불러오지 못했습니다. 다시 시도해 주세요.": {
    "en": "Could not load standard changes. Try again.",
    "vi": "Không thể tải thay đổi tiêu chuẩn. Hãy thử lại."
  },
  "표준 변경점을 확인할 수 없습니다. 분류와 관리자 권한을 확인해 주세요.": {
    "en": "Could not verify standard changes. Check the classification and administrator access.",
    "vi": "Không thể xác minh thay đổi tiêu chuẩn. Hãy kiểm tra phân loại và quyền quản trị viên."
  },
  "프로젝트 기준정보 관리자 인증에 실패했습니다.": {
    "en": "Project master-data administrator authentication failed.",
    "vi": "Xác thực quản trị viên dữ liệu danh mục dự án thất bại."
  },
  "프로젝트 또는 공용 리소스가 변경되었습니다. 최신 목록을 불러온 뒤 다시 검토해 주세요.": {
    "en": "The project or shared resource changed. Load the latest list and review again.",
    "vi": "Dự án hoặc nguồn lực dùng chung đã thay đổi. Hãy tải danh sách mới nhất và kiểm tra lại."
  },
  "프로젝트 사용 여부 확인 필요": {
    "en": "Project usage verification required",
    "vi": "Cần kiểm tra việc sử dụng trong dự án"
  },
  "프로젝트 작업 구역": {
    "en": "Project work areas",
    "vi": "Khu vực làm việc dự án"
  },
  "프로젝트 전체 기준": {
    "en": "Project-wide basis",
    "vi": "Cơ sở toàn dự án"
  },
  "프로젝트 최신 상태를 확인하지 못했습니다. 다시 시도해 주세요.": {
    "en": "Could not verify the latest project state. Try again.",
    "vi": "Không thể xác minh trạng thái dự án mới nhất. Hãy thử lại."
  },
  "프로젝트를 찾을 수 없습니다. 프로젝트 목록에서 접근 상태를 확인해 주세요.": {
    "en": "Project not found. Check access from the project list.",
    "vi": "Không tìm thấy dự án. Hãy kiểm tra quyền truy cập từ danh sách dự án."
  },
  "프로젝트에서 사용 중인 항목은 삭제할 수 없습니다. 최신 사용 상태를 불러왔습니다.": {
    "en": "Items used by projects cannot be deleted. The latest usage state has been loaded.",
    "vi": "Không thể xóa mục đang được dự án sử dụng. Đã tải trạng thái sử dụng mới nhất."
  },
  "프로젝트에서 사용하지 않음": {
    "en": "Not used by the project",
    "vi": "Không được dự án sử dụng"
  },
  "필리핀": {
    "en": "Philippines",
    "vi": "Philippines"
  },
  "하위 공정, 소속 설비 또는 시스템이 매핑되어 있어 삭제할 수 없습니다. 대신 비활성화를 사용해 주세요.": {
    "en": "Cannot delete because child processes, member equipment or systems are mapped. Deactivate it instead.",
    "vi": "Không thể xóa vì có ánh xạ công đoạn con, thiết bị thành viên hoặc hệ thống. Hãy chuyển sang không hoạt động."
  },
  "현장 공정 ID": {
    "en": "Site process ID",
    "vi": "ID công đoạn hiện trường"
  },
  "현장 공정 정보를 불러오지 못했습니다.": {
    "en": "Could not load site process information.",
    "vi": "Không thể tải thông tin công đoạn hiện trường."
  },
  "현장 공정 정보를 불러오지 못했습니다. 다시 불러오기를 선택해 주세요.": {
    "en": "Could not load site process information. Select Reload.",
    "vi": "Không thể tải thông tin công đoạn hiện trường. Hãy chọn Tải lại."
  },
  "현재 기간": {
    "en": "Current period",
    "vi": "Kỳ hiện tại"
  },
  "현재 범위 전체": {
    "en": "Entire current scope",
    "vi": "Toàn bộ phạm vi hiện tại"
  },
  "화": {
    "en": "Tue",
    "vi": "Thứ Ba"
  },
  "확정된 기간·기준일만 가져왔습니다. 다른 분석의 개인·범위는 자동 동기화하지 않습니다.": {
    "en": "Only the confirmed period and reference date were imported. Individuals and scopes from other analyses are not synchronized automatically.",
    "vi": "Chỉ lấy kỳ và ngày tham chiếu đã xác nhận. Cá nhân và phạm vi từ phân tích khác không tự động đồng bộ."
  },
  "환경 설정": {
    "en": "Preferences",
    "vi": "Tùy chọn"
  },
  "활성 상태의 항목이 없습니다.": {
    "en": "No active items.",
    "vi": "Không có mục hoạt động."
  },
  "활성 유형이 없습니다.": {
    "en": "No active types.",
    "vi": "Không có loại hoạt động."
  }
} as const;
