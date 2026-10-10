// Each child tree belongs to an OS Job Object before its first instruction.
// Closing this wrapper, including taskkill or parent failure, kills that tree.
const script = `$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class FeedbackJob {
 [StructLayout(LayoutKind.Sequential)] struct Basic { public long ProcessTime,JobTime; public uint Flags; public UIntPtr Min,Max; public uint Active; public UIntPtr Affinity; public uint Priority,Scheduling; }
 [StructLayout(LayoutKind.Sequential)] struct IO { public ulong ReadOps,WriteOps,OtherOps,ReadBytes,WriteBytes,OtherBytes; }
 [StructLayout(LayoutKind.Sequential)] struct Extended { public Basic Basic; public IO IO; public UIntPtr ProcessMemory,JobMemory,PeakProcess,PeakJob; }
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup { public uint Size; public string Reserved,Desktop,Title; public uint X,Y,XSize,YSize,XChars,YChars,Fill,Flags; public ushort Show,ReservedSize; public IntPtr ReservedBytes,Input,Output,Error; }
 [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr Process,Thread; public uint ProcessID,ThreadID; }
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int type,IntPtr data,uint length);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern bool CreateProcess(string application,System.Text.StringBuilder command,IntPtr processAttributes,IntPtr threadAttributes,bool inherit,uint flags,IntPtr environment,string directory,ref Startup startup,out ProcessInfo process);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint timeout);
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,uint processID);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForMultipleObjects(uint count,IntPtr[] handles,bool waitAll,uint timeout);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint code);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int which);
 public static int Run(string command,string directory,uint parentID) {
  IntPtr job=CreateJobObject(IntPtr.Zero,null); if(job==IntPtr.Zero) throw new Win32Exception();
  IntPtr parent=IntPtr.Zero;
  ProcessInfo process=new ProcessInfo();
  try {
   parent=OpenProcess(0x00100000,false,parentID); if(parent==IntPtr.Zero) throw new Win32Exception();
   uint parentState=WaitForSingleObject(parent,0); if(parentState==0)return 1; if(parentState!=0x102)throw new Win32Exception();
   Extended limits=new Extended(); limits.Basic.Flags=0x2000;
   int size=Marshal.SizeOf(typeof(Extended)); IntPtr data=Marshal.AllocHGlobal(size);
   try { Marshal.StructureToPtr(limits,data,false); if(!SetInformationJobObject(job,9,data,(uint)size)) throw new Win32Exception(); } finally { Marshal.FreeHGlobal(data); }
   Startup startup=new Startup(); startup.Size=(uint)Marshal.SizeOf(typeof(Startup)); startup.Flags=0x100; startup.Input=GetStdHandle(-10); startup.Output=GetStdHandle(-11); startup.Error=GetStdHandle(-12);
   if(!CreateProcess(null,new System.Text.StringBuilder(command),IntPtr.Zero,IntPtr.Zero,true,4,IntPtr.Zero,directory,ref startup,out process)) throw new Win32Exception();
   if(!AssignProcessToJobObject(job,process.Process)) { TerminateProcess(process.Process,1); throw new Win32Exception(); }
   parentState=WaitForSingleObject(parent,0); if(parentState==0)return 1; if(parentState!=0x102)throw new Win32Exception();
   if(ResumeThread(process.Thread)==0xffffffff) throw new Win32Exception();
   uint ended=WaitForMultipleObjects(2,new IntPtr[]{process.Process,parent},false,0xffffffff);
   if(ended==1)return 1; if(ended!=0)throw new Win32Exception();
   uint code; if(!GetExitCodeProcess(process.Process,out code)) throw new Win32Exception(); return unchecked((int)code);
  } finally { if(process.Thread!=IntPtr.Zero)CloseHandle(process.Thread); if(process.Process!=IntPtr.Zero)CloseHandle(process.Process); CloseHandle(job); if(parent!=IntPtr.Zero)CloseHandle(parent); }
 }
}
'@
try { exit [FeedbackJob]::Run($env:WAILS_FEEDBACK_CHILD_COMMAND,$env:WAILS_FEEDBACK_CHILD_DIRECTORY,[uint32]$env:WAILS_FEEDBACK_PARENT_PID) } catch { Write-Error 'Unable to run an isolated feedback child process.'; exit 1 }
`;

export function quoteWindowsArgument(value) {
  if (/[\r\n\0]/.test(value)) throw new Error("Invalid Windows child argument.");
  return '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1') + '"';
}

export function windowsProcess(command, args, directory, environment) {
  let childCommand = [command, ...args].map(quoteWindowsArgument).join(" ");
  if (/(?:^|[\\/])cmd\.exe$/i.test(command)) {
    if (args.length !== 4 || args.slice(0, 3).join(" ") !== "/d /s /c" || !/^[a-zA-Z0-9:._ -]+$/.test(args[3])) throw new Error("Unsupported Windows command launcher.");
    // cmd parses its switches before applying /s to the command string.
    childCommand = quoteWindowsArgument(command) + ' /d /s /c "' + args[3] + '"';
  }
  return {
    command: "powershell.exe",
    args: ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
    env: { ...environment, WAILS_FEEDBACK_CHILD_COMMAND: childCommand, WAILS_FEEDBACK_CHILD_DIRECTORY: directory, WAILS_FEEDBACK_PARENT_PID: String(process.pid) },
  };
}
