import * as React from "react";
import { ScrollView, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { Stack } from "expo-router";

type ListItem = {
  label?: string;
  body: string;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2.5">
      <Text className="text-lg font-semibold text-foreground">{title}</Text>
      {children}
    </View>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text className="text-[15px] leading-7 text-foreground">{children}</Text>;
}

function NumberedList({ items }: { items: ListItem[] }) {
  return (
    <View className="gap-2">
      {items.map((item, index) => (
        <View
          key={index}
          className="flex-row gap-2"
        >
          <Text className="text-[15px] leading-7 text-muted-foreground">{index + 1}.</Text>
          <Text className="flex-1 text-[15px] leading-7 text-foreground">
            {item.label ? <Text className="font-semibold">{item.label}</Text> : null}
            {item.label ? " — " : null}
            {item.body}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TableCell({
  children,
  flex,
  isHeader,
  isFirst,
}: {
  children: string;
  flex: number;
  isHeader?: boolean;
  isFirst?: boolean;
}) {
  return (
    <View
      style={{ flex }}
      className={cn("px-3 py-2.5", !isFirst && "border-l border-border")}
    >
      <Text
        className={cn(
          "text-[13px] leading-5",
          isHeader ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {children}
      </Text>
    </View>
  );
}

function TableRow({ cells, isHeader }: { cells: [string, string, string]; isHeader?: boolean }) {
  return (
    <View className={cn("flex-row", isHeader ? "bg-muted" : "border-t border-border")}>
      <TableCell
        flex={2}
        isHeader={isHeader}
        isFirst
      >
        {cells[0]}
      </TableCell>
      <TableCell
        flex={1.1}
        isHeader={isHeader}
      >
        {cells[1]}
      </TableCell>
      <TableCell
        flex={2.4}
        isHeader={isHeader}
      >
        {cells[2]}
      </TableCell>
    </View>
  );
}

function ProcessorTable() {
  return (
    <View className="overflow-hidden rounded-xl border border-border">
      <TableRow
        isHeader
        cells={["수탁업체", "국가", "위탁 업무"]}
      />
      <TableRow
        cells={["Amazon Web Services, Inc.", "한국(서울 리전)", "서버 호스팅 및 데이터 보관"]}
      />
      <TableRow
        cells={[
          "Google LLC",
          "미국",
          "콘텐츠 AI 요약·분류(Gemini), 서비스 이용 분석(Firebase Analytics)",
        ]}
      />
      <TableRow cells={["OpenAI, L.L.C.", "미국", "콘텐츠 AI 요약·분류"]} />
    </View>
  );
}

export function PrivacyPolicyScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "개인정보처리방침",
          headerBackTitle: " ",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="px-5 py-6 pb-16"
      >
        <View className="mx-auto w-full max-w-2xl gap-7">
          <Text className="text-[15px] leading-7 text-muted-foreground">
            에이링크는 개인 개발자가 운영하는 링크·QR 북마크 서비스로, 관련 법령에 따라 이용자의
            개인정보가 안전하게 관리됩니다. 본 방침은 에이링크에서 개인정보가 어떻게 처리되는지를
            안내합니다.
          </Text>

          <Section title="제1조 (수집하는 개인정보 항목)">
            <Paragraph>에이링크에선 서비스 제공에 필요한 최소한의 정보만 수집됩니다.</Paragraph>
            <NumberedList
              items={[
                {
                  label: "회원 정보",
                  body: "소셜 로그인 식별자(카카오·구글·네이버·애플 계정의 고유 ID), 이용자가 설정한 닉네임 및 프로필 이미지",
                },
                {
                  label: "이용자가 저장한 콘텐츠",
                  body: "저장한 링크(URL), QR 데이터, 메모 및 태그",
                },
                {
                  label: "푸시 알림 토큰",
                  body: "이용자가 설정한 액션 알림을 보내기 위한 기기 토큰",
                },
                {
                  label: "서비스 이용 분석 정보",
                  body: "서비스 이용 분석을 위해 Firebase Analytics(Google)가 사용되며, 이 과정에서 기기 정보와 앱 이용 기록이 자동으로 수집됩니다.",
                },
              ]}
            />
            <Paragraph>
              QR 스캔을 위한 카메라 접근은 기기 내에서만 처리되어 영상·이미지가 저장되지 않으며,
              사진 접근은 이용자가 프로필 이미지를 등록할 때만 사용됩니다.
            </Paragraph>
          </Section>

          <Section title="제2조 (개인정보의 이용 목적)">
            <Paragraph>에이링크에선 수집된 개인정보가 다음 목적으로만 이용됩니다.</Paragraph>
            <NumberedList
              items={[
                { body: "소셜 로그인을 통한 회원 식별 및 서비스 제공" },
                { body: "이용자가 저장한 링크·콘텐츠의 AI 자동 요약·분류 및 태그 생성" },
                { body: "이용자가 설정한 액션 알림 발송" },
                { body: "문의 처리 및 부정 이용 방지 등 서비스의 안정적 운영" },
                { body: "서비스 이용 분석을 통한 서비스 개선" },
              ]}
            />
          </Section>

          <Section title="제3조 (개인정보 처리의 위탁 및 국외 이전)">
            <Paragraph>
              에이링크에선 서비스 운영을 위하여 다음과 같이 개인정보 처리가 위탁되고 있으며, 일부는
              국외로 이전됩니다. 위탁된 정보는 처리 목적이 달성되거나 회원이 탈퇴하면 파기되며, 국외
              이전은 서비스 이용 시점에 정보통신망을 통해 이루어집니다.
            </Paragraph>
            <ProcessorTable />
          </Section>

          <Section title="제4조 (개인정보의 보유 및 파기)">
            <NumberedList
              items={[
                {
                  body: "에이링크에선 별도의 보유기간을 두지 않으며, 회원이 탈퇴하면 보유 중인 개인정보가 지체 없이 파기됩니다.",
                },
                { body: "전자적 파일 형태의 정보는 복구할 수 없는 방법으로 삭제됩니다." },
              ]}
            />
          </Section>

          <Section title="제5조 (이용자의 권리와 행사 방법)">
            <NumberedList
              items={[
                {
                  body: "이용자는 언제든지 자신의 개인정보를 조회·수정하거나, 회원 탈퇴를 통해 수집·이용 동의를 철회할 수 있습니다.",
                },
                {
                  body: "권리 행사는 앱 내 설정 메뉴 또는 아래 개인정보 보호책임자의 이메일로 요청할 수 있으며, 요청 시 지체 없이 조치됩니다.",
                },
              ]}
            />
          </Section>

          <Section title="제6조 (만 14세 미만 아동의 개인정보)">
            <Paragraph>
              에이링크에선 만 14세 미만 아동의 개인정보가 수집되지 않으며, 만 14세 이상의 이용자에
              한하여 서비스 이용이 허용됩니다.
            </Paragraph>
          </Section>

          <Section title="제7조 (개인정보의 안전성 확보 조치)">
            <Paragraph>
              에이링크에선 개인정보의 분실·도난·유출·변조·훼손을 방지하기 위하여 접근 권한 관리,
              데이터의 암호화 전송, 보안 시스템 운영 등 필요한 조치가 이루어집니다.
            </Paragraph>
          </Section>

          <Section title="제8조 (쿠키 등 자동 수집 장치)">
            <Paragraph>
              에이링크에선 웹에서 로그인 유지를 위해 쿠키가 사용됩니다. 이용자는 웹브라우저 설정을
              통해 쿠키 저장을 거부할 수 있으며, 이 경우 로그인이 필요한 일부 기능 이용에 제한이
              있을 수 있습니다.
            </Paragraph>
          </Section>

          <Section title="제9조 (개인정보 보호책임자)">
            <Paragraph>
              에이링크에선 개인정보 처리에 관한 업무를 총괄하고 이용자의 문의·불만을 처리하기 위하여
              개인정보 보호책임자를 두고 있습니다.
            </Paragraph>
            <View className="gap-1 rounded-xl border border-border bg-muted/40 px-4 py-3">
              <Text className="text-[15px] leading-7 text-foreground">
                <Text className="font-semibold">운영자(개인정보 보호책임자)</Text> 송인재
              </Text>
              <Text className="text-[15px] leading-7 text-foreground">
                <Text className="font-semibold">이메일</Text> qlinkk1004@gmail.com
              </Text>
            </View>
          </Section>

          <Section title="제10조 (본 방침의 변경)">
            <Paragraph>
              본 방침은 법령이나 서비스 내용의 변경에 따라 개정될 수 있으며, 개정 시 앱 또는 웹의
              공지를 통해 시행일로부터 최소 7일(이용자 권리에 중요한 변경은 30일) 이전에 안내됩니다.
            </Paragraph>
          </Section>
        </View>
      </ScrollView>
    </>
  );
}
