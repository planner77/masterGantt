ALTER TABLE resources
ADD COLUMN developer_grade TEXT
CHECK (
  developer_grade IS NULL
  OR developer_grade IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT')
);
