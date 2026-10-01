Attribute VB_Name = "Issue345SummaryJson"
Option Explicit

' Issue #345 sample only: fields for an unestimated Summary in IMPORT_SCHEMA 1.0.
' This is not a workbook reader, full payload exporter, or production add-in.
' The server remains authoritative for schema and business validation.
Public Function EmptySummaryScheduleJsonFields() As String
    EmptySummaryScheduleJsonFields = _
        """scheduleMode"":""auto""," & _
        """requestedStart"":null," & _
        """start"":null," & _
        """end"":null," & _
        """duration"":null," & _
        """progress"":null"
End Function

' Quote a VBA Unicode string as a JSON string value. UTF-8 byte encoding and
' rejection of unpaired surrogates must be performed by the approved writer.
Public Function JsonQuotedString(ByVal value As String) As String
    Dim result As String
    Dim character As String
    Dim codeUnit As Long
    Dim index As Long

    result = """"
    For index = 1 To Len(value)
        character = Mid$(value, index, 1)
        codeUnit = AscW(character)
        If codeUnit < 0 Then codeUnit = codeUnit + 65536

        Select Case codeUnit
            Case 34
                result = result & Chr$(92) & Chr$(34)
            Case 92
                result = result & Chr$(92) & Chr$(92)
            Case 8
                result = result & Chr$(92) & "b"
            Case 9
                result = result & Chr$(92) & "t"
            Case 10
                result = result & Chr$(92) & "n"
            Case 12
                result = result & Chr$(92) & "f"
            Case 13
                result = result & Chr$(92) & "r"
            Case 0 To 31
                result = result & Chr$(92) & "u00" & Right$("0" & Hex$(codeUnit), 2)
            Case Else
                result = result & character
        End Select
    Next index
    JsonQuotedString = result & """"
End Function
