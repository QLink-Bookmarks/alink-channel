import { View } from "react-native";

import type { Meta, StoryObj } from "@storybook/react-native";

import { Button } from "./button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Input } from "./input";
import { Text } from "./text";

const meta = {
  title: "공통 UI/다이얼로그",
  component: Dialog,
  decorators: [
    (Story) => (
      <View className="items-start p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "기본",
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Text>프로필 수정</Text>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>프로필 수정</DialogTitle>
          <DialogDescription>앱 전체에서 사용할 표시 이름을 수정한다.</DialogDescription>
        </DialogHeader>
        <Input defaultValue="ALINK 팀" />
        <DialogFooter>
          <DialogClose asChild>
            <Button>
              <Text>변경사항 저장</Text>
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const WithoutCloseButton: Story = {
  name: "닫기 버튼 없이",
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Text>폴더 이동</Text>
        </Button>
      </DialogTrigger>
      <DialogContent hideCloseButton>
        <DialogHeader>
          <DialogTitle>폴더 이동</DialogTitle>
          <DialogDescription>아래 취소·확인으로만 닫는다.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">
              <Text>취소</Text>
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>
              <Text>확인</Text>
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
